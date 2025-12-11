import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, AlertCircle, UserPlus, Calendar } from 'lucide-react';

interface NoAthleteBlockProps {
  featureName: string;
  children: React.ReactNode;
}

/**
 * A wrapper component that blocks parent/athlete access to team features
 * until they have joined a team or added at least one athlete to a team.
 */
const NoAthleteBlock: React.FC<NoAthleteBlockProps> = ({ featureName, children }) => {
  const { userData, players, teamData } = useAuth();
  
  // Block for parents with no athletes at all
  const isParentWithNoAthlete = userData?.role === 'Parent' && players.length === 0;
  
  // Block for parents who have athletes but NONE are on a team yet
  const isParentWithNoTeamedAthlete = userData?.role === 'Parent' && 
    players.length > 0 && 
    !teamData?.id;  // No team data means no athletes are on a team
  
  // Block for athletes without a team
  const isAthleteWithNoTeam = userData?.role === 'Athlete' && !teamData?.id;
  
  // If no blocking conditions, show children
  if (!isParentWithNoAthlete && !isParentWithNoTeamedAthlete && !isAthleteWithNoTeam) {
    return <>{children}</>;
  }
  
  // Athlete view OR Parent with athletes not on a team - needs to join/register for a team
  if (isAthleteWithNoTeam || isParentWithNoTeamedAthlete) {
    const isParent = userData?.role === 'Parent';
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-950 rounded-2xl p-8 max-w-lg text-center border border-purple-200 dark:border-purple-900/30 shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            {isParent ? 'Register Your Athlete for a Team' : 'Join a Team to Get Started'}
          </h2>
          
          <p className="text-slate-600 dark:text-zinc-400 mb-6 text-lg">
            To access <span className="font-semibold text-purple-600 dark:text-purple-400">{featureName}</span>, {isParent ? 'your athlete needs to be' : 'you need to be'} registered for a team first.
          </p>
          
          <div className="bg-white dark:bg-zinc-900/50 border border-purple-200 dark:border-purple-900/30 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3 text-left">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Find a Team</h4>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Browse upcoming events and registration opportunities to {isParent ? 'register your athlete for' : 'join'} a team in your area.
                </p>
              </div>
            </div>
          </div>
          
          <a 
            href="#/events" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
          >
            <Calendar className="w-5 h-5" /> Browse Events & Register
          </a>
          
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-4">
            {featureName} will be available once {isParent ? 'your athlete joins' : 'you join'} a team
          </p>
        </div>
      </div>
    );
  }
  
  // Parent view - needs to add an athlete first (no players at all)
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
