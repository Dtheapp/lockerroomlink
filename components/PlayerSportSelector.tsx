import React, { useState } from 'react';
import { useAuth, SportContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronDown, Trophy, Clock, Circle, User, Users, Check } from 'lucide-react';
import type { SportType, Player } from '../types';

// All sports the system supports
const ALL_SPORTS: { sport: SportType; emoji: string; label: string }[] = [
  { sport: 'football', emoji: '🏈', label: 'Football' },
  { sport: 'basketball', emoji: '🏀', label: 'Basketball' },
  { sport: 'cheer', emoji: '📣', label: 'Cheer' },
  { sport: 'soccer', emoji: '⚽', label: 'Soccer' },
  { sport: 'baseball', emoji: '⚾', label: 'Baseball' },
  { sport: 'volleyball', emoji: '🏐', label: 'Volleyball' },
];

const PlayerSportSelector: React.FC = () => {
  const { 
    userData, 
    players, 
    selectedPlayer, 
    setSelectedPlayer,
    sportContexts, 
    selectedSportContext, 
    setSelectedSportContext 
  } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'player' | 'sport'>('sport');

  // Only show for parents with players
  if (userData?.role !== 'Parent' || players.length === 0) {
    return null;
  }

  // Build list of all sports with their status
  const sportsWithStatus = ALL_SPORTS.map(sportInfo => {
    const context = sportContexts.find(c => c.sport === sportInfo.sport);
    return {
      ...sportInfo,
      context,
      status: context?.status || 'none',
    };
  });

  const getStatusInfo = (status: string, context?: SportContext) => {
    if (status === 'active') {
      return {
        icon: <Trophy className="w-3 h-3" />,
        text: context?.teamName || 'On Team',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10',
      };
    }
    if (status === 'draft_pool') {
      return {
        icon: <Clock className="w-3 h-3" />,
        text: context?.draftPoolTeamName || 'Draft Pool',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
      };
    }
    return {
      icon: <Circle className="w-2 h-2" />,
      text: 'Not Registered',
      color: 'text-zinc-400',
      bg: 'bg-zinc-500/10',
    };
  };

  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    // Don't close - let them also pick a sport if needed
  };

  const handleSelectSport = (sportInfo: typeof sportsWithStatus[0]) => {
    if (sportInfo.context) {
      setSelectedSportContext(sportInfo.context);
    } else {
      setSelectedSportContext({
        sport: sportInfo.sport,
        status: 'none',
      });
    }
    setIsOpen(false);
  };

  // Get current display info
  const currentSportInfo = ALL_SPORTS.find(s => s.sport === selectedSportContext?.sport);
  const statusInfo = selectedSportContext 
    ? getStatusInfo(selectedSportContext.status, selectedSportContext)
    : null;

  return (
    <div className="relative">
      {/* Main Button - Unified Player + Sport Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-xl overflow-hidden transition-all duration-200 ${
          isOpen 
            ? 'ring-2 ring-purple-500 dark:ring-orange-500' 
            : 'hover:shadow-lg'
        }`}
      >
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 dark:from-orange-600 dark:via-orange-500 dark:to-amber-500 p-3">
          <div className="flex items-center gap-3">
            {/* Player Avatar */}
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg shadow-inner">
              {selectedPlayer?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            
            {/* Player & Sport Info */}
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold truncate">
                  {selectedPlayer?.name || 'Select Player'}
                </span>
              </div>
              
              {/* Sport & Status Row */}
              <div className="flex items-center gap-2 mt-0.5">
                {currentSportInfo && (
                  <span className="text-white/90 text-sm flex items-center gap-1">
                    <span>{currentSportInfo.emoji}</span>
                    <span>{currentSportInfo.label}</span>
                  </span>
                )}
                {statusInfo && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color} flex items-center gap-1`}>
                    {statusInfo.icon}
                    <span className="truncate max-w-[80px]">{statusInfo.text}</span>
                  </span>
                )}
              </div>
            </div>
            
            {/* Dropdown Arrow */}
            <ChevronDown className={`w-5 h-5 text-white/80 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl shadow-2xl border z-50 overflow-hidden ${
            theme === 'dark' 
              ? 'bg-zinc-900 border-zinc-700' 
              : 'bg-white border-slate-200'
          }`}>
            {/* Tab Headers */}
            <div className={`flex border-b ${theme === 'dark' ? 'border-zinc-700' : 'border-slate-200'}`}>
              {players.length > 1 && (
                <button
                  onClick={() => setActiveTab('player')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === 'player'
                      ? theme === 'dark'
                        ? 'bg-purple-900/30 text-purple-400 border-b-2 border-purple-500'
                        : 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                      : theme === 'dark'
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Players
                </button>
              )}
              <button
                onClick={() => setActiveTab('sport')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'sport'
                    ? theme === 'dark'
                      ? 'bg-purple-900/30 text-purple-400 border-b-2 border-purple-500'
                      : 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                    : theme === 'dark'
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Trophy className="w-4 h-4" />
                Sports
              </button>
            </div>
            
            {/* Tab Content */}
            <div className="max-h-[280px] overflow-y-auto">
              {/* Players Tab */}
              {activeTab === 'player' && players.length > 1 && (
                <div className="p-2 space-y-1">
                  {players.map((player) => {
                    const isSelected = selectedPlayer?.id === player.id;
                    
                    return (
                      <button
                        key={player.id}
                        onClick={() => handleSelectPlayer(player)}
                        className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                          isSelected
                            ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500 dark:ring-purple-400 shadow-lg shadow-purple-500/20'
                            : theme === 'dark'
                              ? 'hover:bg-zinc-800 text-white'
                              : 'hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          isSelected
                            ? 'bg-purple-500 dark:bg-purple-600 text-white ring-2 ring-purple-300 dark:ring-purple-400'
                            : theme === 'dark'
                              ? 'bg-zinc-700 text-zinc-300'
                              : 'bg-slate-200 text-slate-700'
                        }`}>
                          {player.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 text-left">
                          <div className={`font-medium ${isSelected ? 'text-purple-700 dark:text-purple-300' : ''}`}>
                            {player.name}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="text-purple-500 dark:text-purple-400">
                            <Check className="w-5 h-5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* Sports Tab */}
              {activeTab === 'sport' && (
                <div className="p-2 space-y-1">
                  {sportsWithStatus.map((sportInfo) => {
                    const isRegistered = sportInfo.status === 'active' || sportInfo.status === 'draft_pool';
                    const isSelected = selectedSportContext?.sport === sportInfo.sport;
                    const teamName = sportInfo.context?.teamName || sportInfo.context?.draftPoolTeamName;
                    
                    return (
                      <button
                        key={sportInfo.sport}
                        onClick={() => handleSelectSport(sportInfo)}
                        className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                          isSelected
                            ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500 dark:ring-purple-400 shadow-lg shadow-purple-500/20'
                            : theme === 'dark'
                              ? 'hover:bg-zinc-800'
                              : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Status Light */}
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isRegistered 
                            ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' 
                            : 'bg-red-500 shadow-lg shadow-red-500/50'
                        }`} />
                        
                        {/* Sport Emoji */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${
                          isRegistered
                            ? 'bg-emerald-500/10 dark:bg-emerald-500/20'
                            : theme === 'dark'
                              ? 'bg-zinc-800'
                              : 'bg-slate-100'
                        }`}>
                          {sportInfo.emoji}
                        </div>
                        
                        {/* Sport Name & Status */}
                        <div className="flex-1 text-left min-w-0">
                          <div className={`font-medium ${
                            isSelected
                              ? 'text-purple-700 dark:text-purple-300'
                              : theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}>
                            {sportInfo.label}
                          </div>
                          <div className={`text-xs truncate ${
                            isRegistered 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : 'text-red-500 dark:text-red-400'
                          }`}>
                            {isRegistered ? (
                              <>
                                {sportInfo.status === 'active' && <span>✓ {teamName || 'On Team'}</span>}
                                {sportInfo.status === 'draft_pool' && <span>⏳ Draft Pool: {teamName || 'Waiting'}</span>}
                              </>
                            ) : (
                              <span>✗ Not Registered</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="text-purple-500 dark:text-purple-400 flex-shrink-0">
                            <Check className="w-5 h-5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PlayerSportSelector;

