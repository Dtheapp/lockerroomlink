import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronDown } from 'lucide-react';

// All available sports
const ALL_SPORTS = [
  'Football',
  'Basketball', 
  'Soccer',
  'Baseball',
  'Softball',
  'Volleyball',
  'Cheer',
  'Track',
  'Wrestling',
  'Hockey',
  'Lacrosse',
  'Tennis',
  'Golf',
  'Swimming',
];

const CommissionerSportSelector: React.FC = () => {
  const { theme } = useTheme();
  
  // Get selected sport from localStorage
  const [selectedSport, setSelectedSport] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('commissioner_selected_sport') || 'Football';
    }
    return 'Football';
  });
  
  // Handle sport change
  const handleSportChange = (sport: string) => {
    setSelectedSport(sport);
    localStorage.setItem('commissioner_selected_sport', sport);
    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('commissioner-sport-changed', { detail: sport }));
  };
  
  // Get sport emoji
  const getSportEmoji = (sport: string) => {
    const emojiMap: Record<string, string> = {
      'Football': '🏈',
      'Basketball': '🏀',
      'Soccer': '⚽',
      'Baseball': '⚾',
      'Softball': '🥎',
      'Volleyball': '🏐',
      'Cheer': '📣',
      'Track': '🏃',
      'Wrestling': '🤼',
      'Hockey': '🏒',
      'Lacrosse': '🥍',
      'Tennis': '🎾',
      'Golf': '⛳',
      'Swimming': '🏊',
    };
    return emojiMap[sport] || '🏆';
  };
  
  return (
    <div className="relative">
      <label className={`block text-xs font-medium mb-1.5 ${
        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
      }`}>
        Select Sport
      </label>
      <div className="relative">
        <select
          value={selectedSport}
          onChange={(e) => handleSportChange(e.target.value)}
          className={`w-full appearance-none px-3 py-2.5 pr-10 rounded-xl text-sm font-medium cursor-pointer transition-all ${
            theme === 'dark'
              ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:border-purple-500/50 focus:ring-2 focus:ring-purple-500/50'
              : 'bg-purple-50 border border-purple-200 text-purple-700 hover:border-purple-300 focus:ring-2 focus:ring-purple-500/30'
          } focus:outline-none`}
        >
          {ALL_SPORTS.map((sport) => (
            <option key={sport} value={sport} className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}>
              {getSportEmoji(sport)} {sport}
            </option>
          ))}
        </select>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
          theme === 'dark' ? 'text-purple-400' : 'text-purple-500'
        }`} />
      </div>
    </div>
  );
};

export default CommissionerSportSelector;
