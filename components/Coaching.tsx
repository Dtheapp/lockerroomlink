import React from 'react';
import CoachPlaybook from './CoachPlaybook';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Lock } from 'lucide-react';

const Coaching: React.FC = () => {
  const { userData } = useAuth();

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
