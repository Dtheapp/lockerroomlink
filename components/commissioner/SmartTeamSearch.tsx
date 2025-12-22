/**
 * Smart Team Search Component
 * 
 * A searchable dropdown for finding opponent teams across the system.
 * Features:
 * - Search all teams by sport + age group
 * - Shows team logo, name, program, city, record
 * - League badge for teams in leagues (non-selectable)
 * - "External Team" option for non-system opponents
 * - Debounced search for performance
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Search, X, Trophy, Building2, MapPin, Users, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { searchTeams, searchProgramTeams, type TeamSearchResult, type TeamSearchOptions } from '../../services/teamSearchService';
import type { SportType } from '../../types';

interface SmartTeamSearchProps {
  // Required props
  sport: SportType;
  ageGroup: string;
  
  // Selection handler
  onSelect: (team: TeamSearchResult | null, externalName?: string) => void;
  
  // Optional config
  currentTeamId?: string;          // Exclude this team from results
  currentProgramId?: string;       // For filtering internal vs external
  searchMode?: 'all' | 'internal' | 'external';  // What teams to show
  placeholder?: string;
  initialValue?: string;           // Pre-fill the input
  disabled?: boolean;
  
  // External team option
  allowExternal?: boolean;         // Show "Add external team" option
}

export default function SmartTeamSearch({
  sport,
  ageGroup,
  onSelect,
  currentTeamId,
  currentProgramId,
  searchMode = 'all',
  placeholder = 'Search for opponent...',
  initialValue = '',
  disabled = false,
  allowExternal = true
}: SmartTeamSearchProps) {
  const { theme } = useTheme();
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<TeamSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamSearchResult | null>(null);
  const [showExternalInput, setShowExternalInput] = useState(false);
  const [externalName, setExternalName] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!ageGroup) {
      setResults([]);
      return;
    }

    setLoading(true);
    
    try {
      const options: TeamSearchOptions = {
        sport,
        ageGroup,
        excludeTeamIds: currentTeamId ? [currentTeamId] : [],
        searchQuery: searchQuery || undefined,
        limit: 20,
        includeLeagueTeams: true
      };
      
      // Adjust based on search mode
      if (searchMode === 'internal' && currentProgramId) {
        options.includeProgramId = currentProgramId;
      } else if (searchMode === 'external' && currentProgramId) {
        options.excludeProgramId = currentProgramId;
      }
      
      const teams = await searchTeams(options);
      setResults(teams);
    } catch (error) {
      console.error('[SmartTeamSearch] Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [sport, ageGroup, currentTeamId, currentProgramId, searchMode]);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedTeam(null);
    setShowDropdown(true);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce search
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Initial search when dropdown opens
  const handleFocus = () => {
    setShowDropdown(true);
    if (results.length === 0 && !loading) {
      performSearch(query);
    }
  };

  // Handle team selection
  const handleSelectTeam = (team: TeamSearchResult) => {
    if (!team.selectable) return;
    
    setSelectedTeam(team);
    setQuery(team.name);
    setShowDropdown(false);
    setShowExternalInput(false);
    onSelect(team);
  };

  // Handle external team
  const handleExternalClick = () => {
    setShowExternalInput(true);
    setShowDropdown(false);
    setExternalName(query); // Pre-fill with current search
  };

  const handleExternalConfirm = () => {
    if (externalName.trim()) {
      setQuery(externalName.trim());
      setShowExternalInput(false);
      onSelect(null, externalName.trim());
    }
  };

  // Clear selection
  const handleClear = () => {
    setQuery('');
    setSelectedTeam(null);
    setShowExternalInput(false);
    setExternalName('');
    onSelect(null);
    inputRef.current?.focus();
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const isDark = theme === 'dark';

  // External team input mode
  if (showExternalInput) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ExternalLink className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <input
            type="text"
            value={externalName}
            onChange={(e) => setExternalName(e.target.value)}
            placeholder="Enter external team name..."
            autoFocus
            className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm ${
              isDark 
                ? 'bg-gray-900 border-amber-500/50 text-white placeholder-gray-500' 
                : 'bg-amber-50 border-amber-300 text-gray-900'
            }`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleExternalConfirm();
              if (e.key === 'Escape') {
                setShowExternalInput(false);
                setShowDropdown(true);
              }
            }}
          />
        </div>
        <button
          onClick={handleExternalConfirm}
          disabled={!externalName.trim()}
          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          onClick={() => {
            setShowExternalInput(false);
            setShowDropdown(true);
          }}
          className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-9 pr-8 py-2 rounded-lg border text-sm ${
            isDark 
              ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500' 
              : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {(query || selectedTeam) && !disabled && (
          <button
            onClick={handleClear}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${isDark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
        {loading && (
          <Loader2 className={`absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full mt-1 rounded-xl shadow-xl border max-h-80 overflow-y-auto ${
            isDark 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}
        >
          {/* Loading state */}
          {loading && results.length === 0 && (
            <div className={`p-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              <span className="text-sm">Searching teams...</span>
            </div>
          )}

          {/* No results */}
          {!loading && results.length === 0 && query && (
            <div className={`p-4 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <AlertCircle className="w-5 h-5 mx-auto mb-2 opacity-50" />
              <span className="text-sm">No teams found for "{query}"</span>
            </div>
          )}

          {/* Team Results */}
          {results.length > 0 && (
            <div className="py-1">
              {results.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  disabled={!team.selectable}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                    team.selectable
                      ? isDark 
                        ? 'hover:bg-gray-700/50 cursor-pointer' 
                        : 'hover:bg-gray-50 cursor-pointer'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Team Logo/Avatar */}
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: team.primaryColor || '#6b7280' }}
                  >
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      team.name?.substring(0, 2).toUpperCase()
                    )}
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {team.name}
                      </span>
                      {team.isInLeague && (
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                          isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
                        }`}>
                          <Trophy className="w-3 h-3" />
                          League
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {team.programName && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {team.programName}
                        </span>
                      )}
                      {team.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {team.city}{team.state ? `, ${team.state}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Record */}
                  {team.record && (
                    <div className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {team.record.wins}-{team.record.losses}
                      {team.record.ties > 0 && `-${team.record.ties}`}
                    </div>
                  )}

                  {/* Non-selectable reason */}
                  {!team.selectable && team.selectableReason && (
                    <div className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                      {team.selectableReason}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* External Team Option */}
          {allowExternal && (
            <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={handleExternalClick}
                className={`w-full px-3 py-3 flex items-center gap-3 text-left transition-colors ${
                  isDark 
                    ? 'hover:bg-amber-500/10 text-amber-400' 
                    : 'hover:bg-amber-50 text-amber-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isDark ? 'bg-amber-500/20' : 'bg-amber-100'
                }`}>
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">Add External Team</div>
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Team not in the system? Enter name manually
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
