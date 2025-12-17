import React from 'react';
import CoachPlaybook from './CoachPlaybook';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Lock, Clock } from 'lucide-react';
import { ComingSoon } from './ui/OSYSComponents';

const Coaching: React.FC = () => {
  const { userData, selectedCoachSport, teamData } = useAuth();

  // Determine the current sport - selectedCoachSport takes priority
  const currentSport = selectedCoachSport || teamData?.sport?.toLowerCase() || 'football';

  // Only coaches should access this page
  if (userData?.role !== 'Coach') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-slate-100 dark:bg-slate-900 p-6 rounded-full mb-6">
          <Lock className="w-16 h-16 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Coach Access Only
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md">
          The Coaching section is only available for coaches. This is where you can design plays and manage your playbook.
        </p>
      </div>
    );
  }

  // Show Coming Soon for non-football sports
  if (currentSport !== 'football') {
    const sportLabels: Record<string, { name: string; emoji: string }> = {
      basketball: { name: 'Basketball', emoji: '🏀' },
      cheer: { name: 'Cheer', emoji: '📣' },
      soccer: { name: 'Soccer', emoji: '⚽' },
      baseball: { name: 'Baseball', emoji: '⚾' },
      volleyball: { name: 'Volleyball', emoji: '🏐' },
      other: { name: 'Other Sports', emoji: '🏆' },
    };
    const sportInfo = sportLabels[currentSport] || { name: 'This Sport', emoji: '🏆' };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-500/30 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 dark:bg-orange-900/50 p-3 rounded-xl">
              <span className="text-3xl">{sportInfo.emoji}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{sportInfo.name} Playbook</h1>
              <p className="text-slate-600 dark:text-slate-400">Design plays, create formations, and assign them to your teams</p>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="bg-white/5 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">{sportInfo.name} Plays Coming Soon!</h2>
            <p className="text-slate-400 max-w-md">
              We're building out the play designer for {sportInfo.name.toLowerCase()}. 
              Right now, play design is available for Football. Check back soon!
            </p>
            <div className="mt-4 px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
              In Development
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-500/30 p-6">
        <div className="flex items-center gap-4">
          <div className="bg-orange-100 dark:bg-orange-900/50 p-3 rounded-xl">
            <BookOpen className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Playbook</h1>
            <p className="text-slate-600 dark:text-slate-400">Design plays, create formations, and assign them to your teams</p>
          </div>
        </div>
      </div>

      {/* Coach Playbook Component - no close button needed since it's a dedicated page */}
      <CoachPlaybook />
    </div>
  );
};

export default Coaching;
