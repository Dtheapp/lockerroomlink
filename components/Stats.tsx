import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import StatsBoard from './stats/StatsBoard';
import EditableStatsBoard from './stats/EditableStatsBoard';
import { BarChart3 } from 'lucide-react';

const Stats: React.FC = () => {
  const { userData } = useAuth();

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-8 h-8 text-sky-500" />
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Team Stats</h1>
      </div>

      {/* Parent View: Read-only Stats */}
      {userData?.role === 'Parent' && (
        <section>
          <StatsBoard />
        </section>
      )}

      {/* Coach View: Editable Stats */}
      {userData?.role === 'Coach' && (
        <section>
          <EditableStatsBoard />
        </section>
      )}

      {/* SuperAdmin View: Editable Stats */}
      {userData?.role === 'SuperAdmin' && (
        <section>
          <EditableStatsBoard />
        </section>
      )}
    </div>
  );
};

export default Stats;
