import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, ChevronDown } from 'lucide-react';

const TeamSelector: React.FC = () => {
  const { userData, coachTeams, teamData, setSelectedTeam } = useAuth();
  
  // Only show for coaches with multiple teams
  if (userData?.role !== 'Coach' || coachTeams.length <= 1) {
    return null;
  }

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value;
    const team = coachTeams.find(t => t.id === teamId);
    if (team) {
      setSelectedTeam(team);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-4 rounded-lg shadow-lg mb-6">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-white/80 mb-1 uppercase tracking-wider">
            Coaching Team
          </label>
          <div className="relative">
            <select
              value={teamData?.id || ''}
              onChange={handleTeamChange}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg py-2 pl-3 pr-10 text-white font-bold text-lg appearance-none focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
            >
              {coachTeams.map(team => (
                <option key={team.id} value={team.id} className="bg-zinc-900 text-white">
                  {team.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white pointer-events-none" />
          </div>
        </div>
      </div>
      {teamData && teamData.record && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-sm text-white/90">
            <span className="font-bold">Record:</span>
            <span className="ml-2 text-white/70">
              {teamData.record.wins}-{teamData.record.losses}-{teamData.record.ties}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default TeamSelector;
