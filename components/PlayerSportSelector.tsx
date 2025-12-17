import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ChevronDown, Check } from 'lucide-react';
import { getPlayerRegistrationStatus, PlayerRegistrationStatus } from '../services/eventService';
import type { SportType, Player } from '../types';

const SPORTS: { sport: SportType; emoji: string; label: string }[] = [
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
    selectedSportContext, 
    setSelectedSportContext 
  } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<PlayerRegistrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch status on mount/player change
  useEffect(() => {
    if (!selectedPlayer?.id) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getPlayerRegistrationStatus(selectedPlayer.id, selectedPlayer.teamId, selectedPlayer.name)
      .then(result => {
        console.log('[Selector] Status fetched:', result);
        setStatus(result);
        
        // Auto-select sport IF none selected AND player has a status
        if (!selectedSportContext && result) {
          const sport = (result.sport === 'other' ? 'football' : result.sport || 'football').toLowerCase() as SportType;
          
          if (result.status === 'in-draft-pool') {
            console.log('[Selector] Auto-selecting draft pool:', sport);
            setSelectedSportContext({
              sport,
              status: 'draft_pool',
              draftPoolTeamName: result.draftPoolTeamName,
            });
          } else if (result.status === 'on-team') {
            console.log('[Selector] Auto-selecting active team:', sport);
            setSelectedSportContext({
              sport,
              status: 'active',
              teamId: result.teamId,
              teamName: result.teamName,
            });
          }
        }
      })
      .catch(err => {
        console.error('[Selector] Error:', err);
        setStatus(null);
      })
      .finally(() => setLoading(false));
  }, [selectedPlayer?.id]);

  // Only for parents with players
  if (userData?.role !== 'Parent' || players.length === 0) return null;

  // Get status for a sport
  const getStatus = (sport: SportType) => {
    if (!status) return { label: 'Not Registered', color: 'text-zinc-400' };
    
    // Normalize to lowercase for comparison
    const statusSport = (status.sport === 'other' ? 'football' : status.sport || '').toLowerCase();
    if (statusSport !== sport.toLowerCase()) return { label: 'Not Registered', color: 'text-zinc-400' };
    
    if (status.status === 'in-draft-pool') {
      return { label: `⏳ ${status.draftPoolTeamName || 'In Draft Pool'}`, color: 'text-amber-500' };
    }
    if (status.status === 'on-team') {
      return { label: `✓ ${status.teamName || 'On Team'}`, color: 'text-emerald-500' };
    }
    return { label: 'Not Registered', color: 'text-zinc-400' };
  };

  // Handle sport selection
  const selectSport = (sport: SportType) => {
    // Check the actual status, not the label
    const statusSport = (status?.sport === 'other' ? 'football' : status?.sport || '').toLowerCase();
    const isThisSport = statusSport === sport.toLowerCase();
    
    if (isThisSport && status?.status === 'in-draft-pool') {
      setSelectedSportContext({
        sport,
        status: 'draft_pool',
        draftPoolTeamName: status?.draftPoolTeamName,
      });
    } else if (isThisSport && status?.status === 'on-team') {
      setSelectedSportContext({
        sport,
        status: 'active',
        teamId: status?.teamId,
        teamName: status?.teamName,
      });
    } else {
      setSelectedSportContext({ sport, status: 'none' });
    }
    setIsOpen(false);
  };

  // Handle player selection
  const selectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setIsOpen(false);
  };

  // Button display - use CONTEXT directly, not local status
  const currentSport = selectedSportContext?.sport;
  const sportInfo = currentSport ? SPORTS.find(s => s.sport === currentSport) : null;
  
  // Get label from context first, fall back to local status
  const getButtonLabel = () => {
    if (loading) return 'Loading...';
    if (!sportInfo) return 'Select Sport';
    
    // Use context status directly
    if (selectedSportContext?.status === 'draft_pool') {
      return `${sportInfo.emoji} ${selectedSportContext.draftPoolTeamName || 'In Draft Pool'}`;
    }
    if (selectedSportContext?.status === 'active') {
      return `${sportInfo.emoji} ${selectedSportContext.teamName || sportInfo.label}`;
    }
    return `${sportInfo.emoji} ${sportInfo.label}`;
  };
  
  const buttonLabel = getButtonLabel();
  const statusColor = selectedSportContext?.status === 'draft_pool' ? 'text-amber-300' :
                      selectedSportContext?.status === 'active' ? 'text-emerald-300' : 'text-white/70';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-xl overflow-hidden transition-all ${isOpen ? 'ring-2 ring-purple-500' : ''}`}
      >
        <div className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {selectedPlayer?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 text-left">
              <div className="text-white font-bold truncate">{selectedPlayer?.name || 'Select Athlete'}</div>
              <div className={`text-sm truncate ${statusColor}`}>
                {buttonLabel}
              </div>
            </div>
            <ChevronDown className={`w-5 h-5 text-white/80 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl shadow-2xl border z-50 overflow-hidden ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-slate-200'
          }`}>
            {/* Sports */}
            <div className={`px-3 py-2 border-b text-xs font-semibold uppercase ${
              theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 text-zinc-400' : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              🏆 Sport
            </div>
            <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
              {SPORTS.map(s => {
                const st = getStatus(s.sport);
                const selected = currentSport === s.sport;
                return (
                  <button
                    key={s.sport}
                    onClick={() => selectSport(s.sport)}
                    className={`w-full p-2.5 rounded-lg flex items-center gap-3 ${
                      selected ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    <div className="flex-1 text-left">
                      <div className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{s.label}</div>
                      <div className={`text-xs ${st.color}`}>{st.label}</div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-purple-500" />}
                  </button>
                );
              })}
            </div>

            {/* Players (only if multiple) */}
            {players.length > 1 && (
              <>
                <div className={`px-3 py-2 border-t border-b text-xs font-semibold uppercase ${
                  theme === 'dark' ? 'border-zinc-700 bg-zinc-800/50 text-zinc-400' : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}>
                  👤 Athlete
                </div>
                <div className="p-2 space-y-1 max-h-[150px] overflow-y-auto">
                  {players.map(p => {
                    const selected = selectedPlayer?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => selectPlayer(p)}
                        className={`w-full p-2.5 rounded-lg flex items-center gap-3 ${
                          selected ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          selected ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-zinc-700'
                        }`}>
                          {p.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className={`flex-1 text-left font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {p.name}
                        </span>
                        {selected && <Check className="w-4 h-4 text-purple-500" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PlayerSportSelector;

