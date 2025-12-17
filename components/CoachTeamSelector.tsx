import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronDown, Check, Users } from 'lucide-react';
import type { SportType, Team } from '../types';

// All sports the system supports
const ALL_SPORTS: { sport: SportType; emoji: string; label: string }[] = [
  { sport: 'football', emoji: '🏈', label: 'Football' },
  { sport: 'basketball', emoji: '🏀', label: 'Basketball' },
  { sport: 'cheer', emoji: '📣', label: 'Cheer' },
  { sport: 'soccer', emoji: '⚽', label: 'Soccer' },
  { sport: 'baseball', emoji: '⚾', label: 'Baseball' },
  { sport: 'volleyball', emoji: '🏐', label: 'Volleyball' },
  { sport: 'other', emoji: '🏆', label: 'Other' },
];

const CoachTeamSelector: React.FC = () => {
  const { 
    userData, 
    coachTeams, 
    teamData, 
    setSelectedTeam,
    selectedCoachSport,
    setSelectedCoachSport 
  } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sport' | 'team'>('sport');

  // Only show for coaches
  if (userData?.role !== 'Coach' && userData?.role !== 'SuperAdmin') {
    return null;
  }

  // Group teams by sport
  const teamsBySport = coachTeams.reduce((acc, team) => {
    const sport = (team.sport || 'other').toLowerCase() as SportType;
    if (!acc[sport]) {
      acc[sport] = [];
    }
    acc[sport].push(team);
    return acc;
  }, {} as Record<string, Team[]>);

  // Current sport PRIORITIZES selectedCoachSport, then falls back to teamData
  const currentSport = (selectedCoachSport || teamData?.sport?.toLowerCase() || 'football') as SportType;
  const currentSportInfo = ALL_SPORTS.find(s => s.sport === currentSport) || ALL_SPORTS[0];

  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team);
    // Also update selected coach sport
    const sport = (team.sport || 'football').toLowerCase() as SportType;
    setSelectedCoachSport(sport);
    setIsOpen(false);
  };

  const handleSelectSport = (sport: SportType) => {
    setSelectedCoachSport(sport);
    // If there's a team in this sport, auto-select it
    const teamsInSport = teamsBySport[sport] || [];
    if (teamsInSport.length === 1) {
      setSelectedTeam(teamsInSport[0]);
    } else if (teamsInSport.length > 1 && teamData?.sport?.toLowerCase() !== sport) {
      // Multiple teams - switch to team tab to let them pick
      setActiveTab('team');
      return; // Don't close yet
    } else if (teamsInSport.length === 0) {
      // No teams in this sport - clear the selected team
      setSelectedTeam(null);
    }
    setIsOpen(false);
  };

  // Get teams for current sport
  const teamsForCurrentSport = teamsBySport[currentSport] || [];

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 rounded-xl border transition-all ${
          isOpen 
            ? theme === 'dark'
              ? 'bg-purple-500/20 border-purple-500/50 ring-2 ring-purple-500/30'
              : 'bg-purple-50 border-purple-300 ring-2 ring-purple-200'
            : theme === 'dark'
              ? 'bg-white/5 hover:bg-white/10 border-white/10'
              : 'bg-slate-100 hover:bg-slate-200 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Sport Emoji */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
            theme === 'dark' ? 'bg-white/10' : 'bg-white'
          }`}>
            {currentSportInfo?.emoji || '🏆'}
          </div>
          
          {/* Team/Sport Info */}
          <div className="flex-1 text-left min-w-0">
            <div className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {teamData?.name || currentSportInfo.label}
            </div>
            <div className={`text-xs flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>{currentSportInfo?.label}</span>
              {teamData?.ageGroup && (
                <>
                  <span>•</span>
                  <span>{teamData.ageGroup}</span>
                </>
              )}
              {!teamData && teamsForCurrentSport.length === 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-400">No team</span>
                </>
              )}
            </div>
          </div>
          
          {/* Chevron */}
          <ChevronDown className={`w-5 h-5 transition-transform ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
          } ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute z-50 w-full mt-2 rounded-xl shadow-xl border overflow-hidden ${
          theme === 'dark' 
            ? 'bg-zinc-900 border-white/10' 
            : 'bg-white border-slate-200'
        }`}>
          {/* Tabs */}
          <div className={`flex border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
            <button
              onClick={() => setActiveTab('sport')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'sport'
                  ? theme === 'dark'
                    ? 'bg-purple-500/20 text-purple-300 border-b-2 border-purple-500'
                    : 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              🏆 Sports
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'team'
                  ? theme === 'dark'
                    ? 'bg-purple-500/20 text-purple-300 border-b-2 border-purple-500'
                    : 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Teams ({coachTeams.length})
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {activeTab === 'sport' ? (
              /* Sport Selection Tab */
              <div className="p-2">
                {ALL_SPORTS.map((sportInfo) => {
                  const teams = teamsBySport[sportInfo.sport] || [];
                  const isSelected = currentSport === sportInfo.sport;
                  
                  return (
                    <button
                      key={sportInfo.sport}
                      onClick={() => handleSelectSport(sportInfo.sport)}
                      className={`w-full px-3 py-3 rounded-lg flex items-center gap-3 transition-colors mb-1 ${
                        isSelected
                          ? theme === 'dark'
                            ? 'bg-purple-500/20 border border-purple-500/30'
                            : 'bg-purple-50 border border-purple-200'
                          : theme === 'dark'
                            ? 'hover:bg-white/5'
                            : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-2xl">{sportInfo.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {sportInfo.label}
                        </div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {teams.length > 0 ? (
                            <span className="text-green-400">{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
                          ) : (
                            <span>No teams yet</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-purple-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Team Selection Tab */
              <>
                {coachTeams.length === 0 ? (
                  <div className={`p-6 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No teams yet</p>
                    <p className="text-xs mt-1">You haven't been added to any teams</p>
                  </div>
                ) : (
                  ALL_SPORTS.map((sportInfo) => {
                    const teams = teamsBySport[sportInfo.sport] || [];
                    if (teams.length === 0) return null;
                    
                    return (
                      <div key={sportInfo.sport}>
                        {/* Sport Header */}
                        <div className={`px-4 py-2 flex items-center gap-2 sticky top-0 ${
                          theme === 'dark' 
                            ? 'bg-zinc-800 border-b border-white/10' 
                            : 'bg-slate-100 border-b border-slate-200'
                        }`}>
                          <span className="text-lg">{sportInfo.emoji}</span>
                          <span className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}>
                            {sportInfo.label}
                          </span>
                          <span className={`text-xs ml-auto ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            {teams.length} team{teams.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        {/* Teams in this sport */}
                        {teams.map((team) => {
                          const isSelected = teamData?.id === team.id;
                          
                          return (
                            <button
                              key={team.id}
                              onClick={() => handleSelectTeam(team)}
                              className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                                isSelected
                                  ? theme === 'dark'
                                    ? 'bg-purple-500/20'
                                    : 'bg-purple-50'
                                  : theme === 'dark'
                                    ? 'hover:bg-white/5'
                                    : 'hover:bg-slate-50'
                              }`}
                            >
                              {/* Team Color Indicator */}
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                                style={{ backgroundColor: team.primaryColor || '#9333ea' }}
                              >
                                {team.name?.charAt(0) || 'T'}
                              </div>
                              
                              {/* Team Details */}
                              <div className="flex-1 text-left min-w-0">
                                <div className={`font-medium truncate ${
                                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                                }`}>
                                  {team.name}
                                </div>
                                <div className={`text-xs ${
                                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                                }`}>
                                  {team.ageGroup && <span>{team.ageGroup}</span>}
                                  {(team as any).programName && (
                                    <span className="ml-1">• {(team as any).programName}</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Selected Check */}
                              {isSelected && (
                                <Check className="w-5 h-5 text-purple-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default CoachTeamSelector;
