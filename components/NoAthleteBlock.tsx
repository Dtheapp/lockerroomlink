import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, AlertCircle, UserPlus, Calendar, Clock, Trophy, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../services/firebase';

interface DraftPoolInfo {
  isInDraftPool: boolean;
  teamName?: string;
  registrationCloseDate?: string;
}

interface NoAthleteBlockProps {
  featureName: string;
  children: React.ReactNode;
}

/**
 * A wrapper component that blocks parent/athlete access to team features
 * until they have joined a team or added at least one athlete to a team.
 */
const NoAthleteBlock: React.FC<NoAthleteBlockProps> = ({ featureName, children }) => {
  const { userData, players, teamData, selectedPlayer } = useAuth();
  const [draftPoolInfo, setDraftPoolInfo] = useState<DraftPoolInfo>({ isInDraftPool: false });
  const [loading, setLoading] = useState(true);
  
  // Check if selected player is in draft pool
  useEffect(() => {
    const checkDraftPool = async () => {
      if (!selectedPlayer?.id) {
        setLoading(false);
        return;
      }
      
      try {
        // Search all teams' draft pools for this player
        const teamsSnap = await getDocs(collection(db, 'teams'));
        
        for (const teamDoc of teamsSnap.docs) {
          const draftPoolQuery = query(
            collection(db, 'teams', teamDoc.id, 'draftPool'),
            where('playerId', '==', selectedPlayer.id),
            where('status', '==', 'waiting')
          );
          const draftSnap = await getDocs(draftPoolQuery);
          
          if (!draftSnap.empty) {
            // Found in draft pool - get registration close date from season
            const teamData = teamDoc.data();
            let closeDate: string | undefined;
            
            // Try to get registration close date from active season
            const seasonsSnap = await getDocs(collection(db, 'teams', teamDoc.id, 'seasons'));
            seasonsSnap.forEach(seasonDoc => {
              const sData = seasonDoc.data();
              if (sData.isActive && sData.registrationCloseDate) {
                closeDate = sData.registrationCloseDate;
              }
            });
            
            setDraftPoolInfo({
              isInDraftPool: true,
              teamName: teamData.name || 'the team',
              registrationCloseDate: closeDate,
            });
            setLoading(false);
            return;
          }
        }
        
        setDraftPoolInfo({ isInDraftPool: false });
        setLoading(false);
      } catch (err) {
        console.error('Error checking draft pool:', err);
        setDraftPoolInfo({ isInDraftPool: false });
        setLoading(false);
      }
    };
    
    checkDraftPool();
  }, [selectedPlayer?.id]);
  
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
  
  // Show loading while checking draft pool
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  // DRAFT POOL VIEW - Player is waiting to be drafted
  if (draftPoolInfo.isInDraftPool && (isAthleteWithNoTeam || isParentWithNoTeamedAthlete)) {
    const isParent = userData?.role === 'Parent';
    const closeDateFormatted = draftPoolInfo.registrationCloseDate 
      ? new Date(draftPoolInfo.registrationCloseDate + 'T23:59:59').toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : null;
    
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-zinc-900 dark:to-zinc-950 rounded-2xl p-8 max-w-lg text-center border border-emerald-200 dark:border-emerald-900/30 shadow-xl">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            🎉 You're in the Draft Pool!
          </h2>
          
          <p className="text-slate-600 dark:text-zinc-400 mb-6 text-lg">
            {isParent ? 'Your athlete is' : "You're"} registered and waiting to be drafted to <span className="font-semibold text-emerald-600 dark:text-emerald-400">{draftPoolInfo.teamName}</span>.
          </p>
          
          <div className="bg-white dark:bg-zinc-900/50 border border-emerald-200 dark:border-emerald-900/30 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3 text-left">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">What happens next?</h4>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {closeDateFormatted ? (
                    <>Registration closes on <span className="font-bold text-emerald-600 dark:text-emerald-400">{closeDateFormatted}</span>. After that, the coach will draft players to the roster.</>
                  ) : (
                    <>The coach will review registrations and draft players to the roster soon.</>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Once {isParent ? 'your athlete is' : "you're"} drafted, the team dashboard will load here automatically.</span>
            </div>
          </div>
        </div>
      </div>
    );
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
