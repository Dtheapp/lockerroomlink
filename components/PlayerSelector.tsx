import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, ChevronDown } from 'lucide-react';
import type { Player } from '../types';

const PlayerSelector: React.FC = () => {
  const { userData, players, selectedPlayer, setSelectedPlayer, teamData } = useAuth();
  
  // Only show for parents with multiple players
  if (userData?.role !== 'Parent' || players.length === 0) {
    return null;
  }

  const handlePlayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const playerId = e.target.value;
    const player = players.find(p => p.id === playerId);
    if (player) {
      setSelectedPlayer(player);
    }
  };

  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 p-4 rounded-lg shadow-lg mb-6">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-white/80 mb-1 uppercase tracking-wider">
            Viewing Player
          </label>
          <div className="relative">
            <select
              value={selectedPlayer?.id || ''}
              onChange={handlePlayerChange}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg py-2 pl-3 pr-10 text-white font-bold text-lg appearance-none focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
            >
              {players.map(player => (
                <option key={player.id} value={player.id} className="bg-zinc-900 text-white">
                  {player.name} #{player.number || '—'}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white pointer-events-none" />
          </div>
        </div>
      </div>
      {teamData && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-sm text-white/90">
            <span className="font-bold">{teamData.name}</span>
            {teamData.record && (
              <span className="ml-2 text-white/70">
                ({teamData.record.wins}-{teamData.record.losses}-{teamData.record.ties})
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default PlayerSelector;
