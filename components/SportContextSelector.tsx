import React from 'react';
import { useAuth, SportContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronDown, Trophy, Clock, Circle } from 'lucide-react';
import type { SportType } from '../types';

// All sports the system supports
const ALL_SPORTS: { sport: SportType; emoji: string; label: string }[] = [
  { sport: 'football', emoji: '🏈', label: 'Football' },
  { sport: 'basketball', emoji: '🏀', label: 'Basketball' },
  { sport: 'cheer', emoji: '📣', label: 'Cheer' },
  { sport: 'soccer', emoji: '⚽', label: 'Soccer' },
  { sport: 'baseball', emoji: '⚾', label: 'Baseball' },
  { sport: 'volleyball', emoji: '🏐', label: 'Volleyball' },
];

const SportContextSelector: React.FC = () => {
  const { sportContexts, selectedSportContext, setSelectedSportContext } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  // Build list of all sports with their status
  const sportsWithStatus = ALL_SPORTS.map(sportInfo => {
    const context = sportContexts.find(c => c.sport === sportInfo.sport);
    return {
      ...sportInfo,
      context,
      status: context?.status || 'none',
    };
  });

  const getStatusBadge = (status: string, context?: SportContext) => {
    if (status === 'active') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Trophy className="w-3 h-3" />
          {context?.teamName || 'On Team'}
        </span>
      );
    }
    if (status === 'draft_pool') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <Clock className="w-3 h-3" />
          Draft Pool{context?.draftPoolTeamName ? `: ${context.draftPoolTeamName}` : ''}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
        <Circle className="w-2 h-2" />
        Not Registered
      </span>
    );
  };

  const getSelectedLabel = () => {
    if (!selectedSportContext) {
      return 'Select Sport';
    }
    const sportInfo = ALL_SPORTS.find(s => s.sport === selectedSportContext.sport);
    return `${sportInfo?.emoji || '🎯'} ${sportInfo?.label || selectedSportContext.sport}`;
  };

  const handleSelectSport = (sportInfo: typeof sportsWithStatus[0]) => {
    if (sportInfo.context) {
      // Player has a context for this sport (active or draft pool)
      setSelectedSportContext(sportInfo.context);
    } else {
      // Player has no context - create a 'none' context for registration
      setSelectedSportContext({
        sport: sportInfo.sport,
        status: 'none',
      });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Current Selection Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
          theme === 'dark' 
            ? 'bg-zinc-800/50 hover:bg-zinc-800 text-white' 
            : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
        }`}
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium">{getSelectedLabel()}</span>
            {selectedSportContext && getStatusBadge(selectedSportContext.status, selectedSportContext)}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl border z-50 overflow-hidden ${
            theme === 'dark' 
              ? 'bg-zinc-900 border-zinc-700' 
              : 'bg-white border-slate-200'
          }`}>
            <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b ${
              theme === 'dark' ? 'text-zinc-500 border-zinc-700 bg-zinc-800/50' : 'text-slate-500 border-slate-200 bg-slate-50'
            }`}>
              Select Sport
            </div>
            
            {/* All Sports */}
            {sportsWithStatus.map((sportInfo) => (
              <button
                key={sportInfo.sport}
                onClick={() => handleSelectSport(sportInfo)}
                className={`w-full px-3 py-3 text-left flex items-center justify-between transition-colors ${
                  selectedSportContext?.sport === sportInfo.sport
                    ? theme === 'dark' 
                      ? 'bg-purple-900/30 text-purple-400' 
                      : 'bg-purple-50 text-purple-700'
                    : theme === 'dark'
                      ? 'hover:bg-zinc-800 text-white'
                      : 'hover:bg-slate-50 text-slate-900'
                }`}
              >
                <span className="font-medium flex items-center gap-2">
                  <span className="text-lg">{sportInfo.emoji}</span>
                  {sportInfo.label}
                </span>
                {getStatusBadge(sportInfo.status, sportInfo.context)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SportContextSelector;
