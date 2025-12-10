/**
 * StateSelector Component
 * A searchable dropdown for US state selection with type-ahead filtering
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// All US states with abbreviations
export const US_STATES = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
  { abbr: 'DC', name: 'District of Columbia' },
];

interface StateSelectorProps {
  value: string;
  onChange: (state: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export const StateSelector: React.FC<StateSelectorProps> = ({
  value,
  onChange,
  required = false,
  placeholder = 'Select state...',
  className = '',
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter states based on search
  const filteredStates = US_STATES.filter(
    (s) =>
      s.abbr.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get the display value
  const selectedState = US_STATES.find((s) => s.abbr === value);
  const displayValue = isOpen ? search : (selectedState ? selectedState.abbr : '');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSearch(val);
    setIsOpen(true);

    // Auto-select if exact match
    const exactMatch = US_STATES.find((s) => s.abbr === val);
    if (exactMatch) {
      onChange(exactMatch.abbr);
    }
  };

  // Handle state selection
  const handleSelect = (abbr: string) => {
    onChange(abbr);
    setSearch('');
    setIsOpen(false);
  };

  // Handle focus
  const handleFocus = () => {
    setIsOpen(true);
    setSearch(value); // Start with current value
  };

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    } else if (e.key === 'Enter' && filteredStates.length === 1) {
      e.preventDefault();
      handleSelect(filteredStates[0].abbr);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={20}
          required={required}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase pr-10 ${
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) inputRef.current?.focus();
          }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-500/20 transition-colors`}
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''} ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}
          />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-lg ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          }`}
        >
          {filteredStates.length === 0 ? (
            <div className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              No states match "{search}"
            </div>
          ) : (
            filteredStates.map((s) => (
              <button
                key={s.abbr}
                type="button"
                onClick={() => handleSelect(s.abbr)}
                className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-purple-500/20 transition-colors ${
                  value === s.abbr
                    ? theme === 'dark'
                      ? 'bg-purple-500/30 text-purple-300'
                      : 'bg-purple-100 text-purple-700'
                    : theme === 'dark'
                    ? 'text-white'
                    : 'text-gray-900'
                }`}
              >
                <span>
                  <span className="font-medium">{s.abbr}</span>
                  <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {s.name}
                  </span>
                </span>
                {value === s.abbr && <Check className="w-4 h-4 text-purple-500" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Validation helper
export const isValidUSState = (abbr: string): boolean => {
  return US_STATES.some((s) => s.abbr === abbr.toUpperCase());
};

export default StateSelector;
