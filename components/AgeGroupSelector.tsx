/**
 * AgeGroupSelector Component
 * 
 * Simplified team type/age group selector:
 * - Youth: 5U-12U (age-based)
 * - School: Middle/High/College with Varsity/JV
 * - Adult: Single "Adult" option
 */

import React, { useState, useMemo } from 'react';
import { AGE_GROUPS, AgeGroup } from '../types';
import { Check, Users, Layers } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface AgeGroupSelectorProps {
  value: string | string[];
  onChange: (value: string | string[], type: 'single' | 'multi') => void;
  mode?: 'single' | 'multi' | 'auto';
  className?: string;
  required?: boolean;
}

// Youth age groups (5U-12U)
const YOUTH_AGE_GROUPS: AgeGroup[] = ['5U', '6U', '7U', '8U', '9U', '10U', '11U', '12U'];

// School types with varsity options
type SchoolType = 'Middle School' | 'High School' | 'College';
type VarsityType = 'Varsity' | 'JV';

// Combined school tags for storage
const SCHOOL_TAGS = {
  'Middle School': { 'Varsity': 'middleVarsity', 'JV': 'middleJV' },
  'High School': { 'Varsity': 'highVarsity', 'JV': 'highJV' },
  'College': { 'Varsity': 'collegeVarsity', 'JV': 'collegeJV' },
} as const;

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
  
  // School selection state
  const [selectedSchoolType, setSelectedSchoolType] = useState<SchoolType | null>(null);
  const [selectedVarsityType, setSelectedVarsityType] = useState<VarsityType | null>(null);
  
  const selectedGroups = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (value) return [value];
    return [];
  }, [value]);

  // Parse existing school tag to set state on mount
  React.useEffect(() => {
    if (selectedGroups.length === 1) {
      const val = selectedGroups[0];
      if (val.startsWith('middle')) {
        setSelectedSchoolType('Middle School');
        setSelectedVarsityType(val.includes('JV') ? 'JV' : 'Varsity');
      } else if (val.startsWith('high')) {
        setSelectedSchoolType('High School');
        setSelectedVarsityType(val.includes('JV') ? 'JV' : 'Varsity');
      } else if (val.startsWith('college')) {
        setSelectedSchoolType('College');
        setSelectedVarsityType(val.includes('JV') ? 'JV' : 'Varsity');
      }
    }
  }, []);

  const handleSingleSelect = (group: string) => {
    // Clear school selection when selecting non-school group
    setSelectedSchoolType(null);
    setSelectedVarsityType(null);
    onChange(group, 'single');
  };

  const handleMultiToggle = (group: string) => {
    // Clear school selection when multi-selecting
    setSelectedSchoolType(null);
    setSelectedVarsityType(null);
    
    const newSelection = selectedGroups.includes(group)
      ? selectedGroups.filter(g => g !== group)
      : [...selectedGroups, group].sort((a, b) => {
          const indexA = AGE_GROUPS.indexOf(a as AgeGroup);
          const indexB = AGE_GROUPS.indexOf(b as AgeGroup);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
    
    onChange(newSelection, 'multi');
  };

  const handleSchoolSelect = (schoolType: SchoolType) => {
    setSelectedSchoolType(schoolType);
    // If varsity is already selected, update the value
    if (selectedVarsityType) {
      const tag = SCHOOL_TAGS[schoolType][selectedVarsityType];
      onChange(tag, 'single');
    }
  };

  const handleVarsitySelect = (varsityType: VarsityType) => {
    setSelectedVarsityType(varsityType);
    // If school type is already selected, update the value
    if (selectedSchoolType) {
      const tag = SCHOOL_TAGS[selectedSchoolType][varsityType];
      onChange(tag, 'single');
    }
  };

  const handleModeChange = (newMode: 'single' | 'multi') => {
    setSelectionMode(newMode);
    setSelectedSchoolType(null);
    setSelectedVarsityType(null);
    if (newMode === 'single' && selectedGroups.length > 0) {
      onChange(selectedGroups[0], 'single');
    } else if (newMode === 'multi' && selectedGroups.length === 1) {
      onChange(selectedGroups, 'multi');
    }
  };

  const displayValue = useMemo(() => {
    if (selectedGroups.length === 0) return '';
    if (selectedGroups.length === 1) {
      const val = selectedGroups[0];
      // Format school tags for display
      if (val === 'middleVarsity') return 'Middle School Varsity';
      if (val === 'middleJV') return 'Middle School JV';
      if (val === 'highVarsity') return 'High School Varsity';
      if (val === 'highJV') return 'High School JV';
      if (val === 'collegeVarsity') return 'College Varsity';
      if (val === 'collegeJV') return 'College JV';
      return val;
    }
    if (selectedGroups.length === 2) return selectedGroups.join('/');
    
    // Check if consecutive youth groups
    const indices = selectedGroups.map(g => YOUTH_AGE_GROUPS.indexOf(g as AgeGroup)).filter(i => i !== -1);
    const isConsecutive = indices.length === selectedGroups.length && 
      indices.every((val, i, arr) => i === 0 || val === arr[i - 1] + 1);
    
    if (isConsecutive && indices.length > 2) {
      return `${selectedGroups[0]}-${selectedGroups[selectedGroups.length - 1]}`;
    }
    
    return selectedGroups.join(', ');
  }, [selectedGroups]);

  const actualMode = mode === 'auto' ? selectionMode : mode;

  // Check if adult is selected
  const isAdultSelected = selectedGroups.includes('Adult');

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
                ? 'bg-purple-600 text-white'
                : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Single
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('multi')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              actualMode === 'multi'
                ? 'bg-purple-600 text-white'
                : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Multi-Age
          </button>
        </div>
      )}

      {/* Display current selection */}
      {displayValue && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Selected: </span>
          <span className="text-purple-500 font-medium">{displayValue}</span>
        </div>
      )}

      {/* Youth Age Groups (5U-12U) */}
      <div>
        <p className={`text-xs uppercase tracking-wider mb-2 font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
          🏈 Youth (Age-Based)
        </p>
        <div className="grid grid-cols-4 gap-2">
          {YOUTH_AGE_GROUPS.map((group) => {
            const isSelected = selectedGroups.includes(group);
            return (
              <button
                key={group}
                type="button"
                onClick={() => actualMode === 'single' ? handleSingleSelect(group) : handleMultiToggle(group)}
                className={`relative py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? `bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                    : theme === 'dark' 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                }`}
              >
                {group}
                {isSelected && actualMode === 'multi' && (
                  <Check className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white rounded-full p-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* School Teams - Only in single mode (not available for multi-age) */}
      {actualMode === 'single' && (
        <div>
          <p className={`text-xs uppercase tracking-wider mb-2 font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
            🏫 School Teams
          </p>
          
          {/* School Type Selection */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {(['Middle School', 'High School', 'College'] as SchoolType[]).map((schoolType) => {
              const isSelected = selectedSchoolType === schoolType;
              return (
                <button
                  key={schoolType}
                  type="button"
                  onClick={() => handleSchoolSelect(schoolType)}
                  className={`py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? `bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                      : theme === 'dark' 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                  }`}
                >
                  {schoolType === 'Middle School' ? 'Middle' : schoolType === 'High School' ? 'High' : 'College'}
                </button>
              );
            })}
          </div>
          
          {/* Varsity/JV Selection - Only show if school type selected */}
          {selectedSchoolType && (
            <div className="grid grid-cols-2 gap-2">
              {(['Varsity', 'JV'] as VarsityType[]).map((varsityType) => {
                const isSelected = selectedVarsityType === varsityType;
                return (
                  <button
                    key={varsityType}
                    type="button"
                    onClick={() => handleVarsitySelect(varsityType)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? `bg-green-600 text-white ring-2 ring-green-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                        : theme === 'dark' 
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
                    }`}
                  >
                    {varsityType === 'JV' ? 'Junior Varsity' : 'Varsity'}
                  </button>
                );
              })}
            </div>
          )}
          
          {selectedSchoolType && !selectedVarsityType && (
            <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
              👆 Select Varsity or JV to continue
            </p>
          )}
        </div>
      )}

      {/* Adult - Only in single mode (not available for multi-age) */}
      {actualMode === 'single' && (
        <div>
          <p className={`text-xs uppercase tracking-wider mb-2 font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
            🏆 Adult (18+)
          </p>
          <button
            type="button"
            onClick={() => handleSingleSelect('Adult')}
            className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              isAdultSelected
                ? `bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-2 ${theme === 'dark' ? 'ring-offset-gray-800' : 'ring-offset-white'}`
                : theme === 'dark' 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900'
            }`}
          >
            Adult League
          </button>
        </div>
      )}

      {actualMode === 'multi' && (
        <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
          💡 Multi-Age is for youth teams only (e.g., 8U/9U combined)
        </p>
      )}
    </div>
  );
};

export default AgeGroupSelector;
