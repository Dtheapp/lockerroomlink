/**
 * AgeGroupSelector Component
 * 
 * Allows selection of single or multiple age groups for team creation.
 * Supports both single-grade and multi-grade team configurations.
 */

import React, { useState, useMemo } from 'react';
import { AGE_GROUPS, AgeGroup } from '../types';
import { Check, Users, Layers } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface AgeGroupSelectorProps {
  value: string | string[];
  onChange: (value: string | string[], type: 'single' | 'multi') => void;
  mode?: 'single' | 'multi' | 'auto'; // 'auto' lets user toggle
  className?: string;
  required?: boolean;
}

// Youth age groups (5U-12U)
const YOUTH_AGE_GROUPS: AgeGroup[] = ['5U', '6U', '7U', '8U', '9U', '10U', '11U', '12U'];

// Middle/High School grades (6th-12th)
const SCHOOL_GRADE_GROUPS: AgeGroup[] = ['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade'];

// College years
const COLLEGE_GROUPS: AgeGroup[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

// Adult league categories
const ADULT_GROUPS: AgeGroup[] = ['Open', 'Adult', 'Masters', 'Seniors', 'Golden'];

// Labels for adult groups (for display)
const ADULT_GROUP_LABELS: Record<string, string> = {
  'Open': 'Open (18+)',
  'Adult': 'Adult (18-39)',
  'Masters': 'Masters (40+)',
  'Seniors': 'Seniors (50+)',
  'Golden': 'Golden (60+)',
};

export const AgeGroupSelector: React.FC<AgeGroupSelectorProps> = ({
  value,
  onChange,
  mode = 'auto',
  className = '',
  required = false,
}) => {
  const { theme } = useTheme();
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>(
    Array.isArray(value) && value.length > 1 ? 'multi' : 'single'
  );
  
  const selectedGroups = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (value) return [value];
    return [];
  }, [value]);

  const handleSingleSelect = (group: string) => {
    onChange(group, 'single');
  };

  const handleMultiToggle = (group: string) => {
    const newSelection = selectedGroups.includes(group)
      ? selectedGroups.filter(g => g !== group)
      : [...selectedGroups, group].sort((a, b) => {
          // Sort by age group order
          const indexA = AGE_GROUPS.indexOf(a as AgeGroup);
          const indexB = AGE_GROUPS.indexOf(b as AgeGroup);
          return indexA - indexB;
        });
    
    onChange(newSelection, 'multi');
  };

  const handleModeChange = (newMode: 'single' | 'multi') => {
    setSelectionMode(newMode);
    if (newMode === 'single' && selectedGroups.length > 0) {
      // Keep only the first selected
      onChange(selectedGroups[0], 'single');
    } else if (newMode === 'multi' && selectedGroups.length === 1) {
      onChange(selectedGroups, 'multi');
    }
  };

  const displayValue = useMemo(() => {
    if (selectedGroups.length === 0) return '';
    if (selectedGroups.length === 1) return selectedGroups[0];
    if (selectedGroups.length === 2) return selectedGroups.join('/');
    
    // Check if consecutive
    const indices = selectedGroups.map(g => AGE_GROUPS.indexOf(g as AgeGroup)).filter(i => i !== -1);
    const isConsecutive = indices.every((val, i, arr) => i === 0 || val === arr[i - 1] + 1);
    
    if (isConsecutive && indices.length > 2) {
      return `${selectedGroups[0]}-${selectedGroups[selectedGroups.length - 1]}`;
    }
    
    return selectedGroups.join(', ');
  }, [selectedGroups]);

  const actualMode = mode === 'auto' ? selectionMode : mode;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Mode Toggle (only in auto mode) */}
      {mode === 'auto' && (
        <div className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'} rounded-lg p-1`}>
          <button
            type="button"
            onClick={() => handleModeChange('single')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              actualMode === 'single'
                ? 'bg-orange-600 text-white'
                : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Single Grade
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('multi')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              actualMode === 'multi'
                ? 'bg-orange-600 text-white'
                : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Multi-Grade
          </button>
        </div>
      )}

      {/* Display current selection */}
      {displayValue && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Selected: </span>
          <span className="text-orange-500 font-medium">{displayValue}</span>
        </div>
      )}

      {/* Youth Age Groups (5U-12U) */}
      <div>
        <p className={`text-xs uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>🏈 Youth (Age-Based)</p>
        <div className="grid grid-cols-4 gap-2">
          {YOUTH_AGE_GROUPS.map((group) => {
            const isSelected = selectedGroups.includes(group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => actualMode === 'single' ? handleSingleSelect(group) : handleMultiToggle(group)}
                className={`relative py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? `bg-orange-600 text-white ring-2 ring-orange-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                    : theme === 'dark' 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                }`}
              >
                {group}
                {isSelected && actualMode === 'multi' && (
                  <Check className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full p-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle/High School Grades */}
      <div>
        <p className={`text-xs uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>🏫 Middle & High School</p>
        <div className="grid grid-cols-4 gap-2">
          {SCHOOL_GRADE_GROUPS.map((group) => {
            const isSelected = selectedGroups.includes(group);
            // Display shorter version for buttons
            const shortLabel = group.replace(' Grade', '');
            return (
              <button
                key={group}
                type="button"
                onClick={() => actualMode === 'single' ? handleSingleSelect(group) : handleMultiToggle(group)}
                className={`relative py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? `bg-orange-600 text-white ring-2 ring-orange-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                    : theme === 'dark' 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                }`}
              >
                {shortLabel}
                {isSelected && actualMode === 'multi' && (
                  <Check className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full p-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* College Years */}
      <div>
        <p className={`text-xs uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>🎓 College</p>
        <div className="grid grid-cols-4 gap-2">
          {COLLEGE_GROUPS.map((group) => {
            const isSelected = selectedGroups.includes(group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => actualMode === 'single' ? handleSingleSelect(group) : handleMultiToggle(group)}
                className={`relative py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? `bg-orange-600 text-white ring-2 ring-orange-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                    : theme === 'dark' 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                }`}
              >
                {group}
                {isSelected && actualMode === 'multi' && (
                  <Check className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full p-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Adult Leagues */}
      <div>
        <p className={`text-xs uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>🏆 Adult Leagues</p>
        <div className="grid grid-cols-5 gap-2">
          {ADULT_GROUPS.map((group) => {
            const isSelected = selectedGroups.includes(group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => actualMode === 'single' ? handleSingleSelect(group) : handleMultiToggle(group)}
                title={ADULT_GROUP_LABELS[group]}
                className={`relative py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? `bg-orange-600 text-white ring-2 ring-orange-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                    : theme === 'dark' 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                }`}
              >
                {group}
                {isSelected && actualMode === 'multi' && (
                  <Check className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full p-0.5" />
                )}
              </button>
            );
          })}
        </div>
        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'}`}>
          Open (18+) • Adult (18-39) • Masters (40+) • Seniors (50+) • Golden (60+)
        </p>
      </div>

      {actualMode === 'multi' && (
        <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
          💡 Select multiple age groups for combined teams (e.g., 8U/9U)
        </p>
      )}
    </div>
  );
};

export default AgeGroupSelector;
