import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, AlertCircle } from 'lucide-react';

interface NoAthleteBlockProps {
  featureName: string;
  children: React.ReactNode;
}

/**
 * A wrapper component that blocks parent access to team features
 * until they have added at least one athlete.
 */
const NoAthleteBlock: React.FC<NoAthleteBlockProps> = ({ featureName, children }) => {
  const { userData, players } = useAuth();
  
  // Only block for parents with no athletes
  const isParentWithNoAthlete = userData?.role === 'Parent' && players.length === 0;
  
  if (!isParentWithNoAthlete) {
    return <>{children}</>;
  }
  
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-8 max-w-md text-center border border-slate-200 dark:border-zinc-800 shadow-lg">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-500" />
        </div>
        
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Add an Athlete First
        </h2>
        
        <p className="text-slate-600 dark:text-zinc-400 mb-6">
          To access <span className="font-semibold text-orange-600 dark:text-orange-400">{featureName}</span>, you need to add at least one athlete to a team.
        </p>
        
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-900/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 text-sm">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>Your athlete will be connected to their team's {featureName.toLowerCase()} once added.</span>
          </div>
        </div>
        
        <a 
          href="#/profile" 
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-orange-900/20"
        >
          <Plus className="w-5 h-5" /> Add Your Athlete
        </a>
        
        <p className="text-xs text-slate-500 mt-4">
          Go to your profile to add your athlete and join a team
        </p>
      </div>
    </div>
  );
};

export default NoAthleteBlock;
