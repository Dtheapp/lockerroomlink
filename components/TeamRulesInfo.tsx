import React, { useState, useEffect } from 'react';
import { FileText, Shield, ChevronRight, BookOpen, Info } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { RulesModal } from './RulesModal';
import type { Team, League, RulesDocument } from '../types';

interface TeamRulesInfoProps {
  teamId: string;
  canEditTeamRules?: boolean; // Can edit team-specific rules
  canEditLeagueRules?: boolean; // Can edit league rules (if in league)
  compact?: boolean; // Compact display mode
}

export const TeamRulesInfo: React.FC<TeamRulesInfoProps> = ({
  teamId,
  canEditTeamRules = false,
  canEditLeagueRules = false,
  compact = false,
}) => {
  const [hasRules, setHasRules] = useState(false);
  const [hasConduct, setHasConduct] = useState(false);
  const [isFromLeague, setIsFromLeague] = useState(false);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showConductModal, setShowConductModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRulesStatus();
  }, [teamId]);

  const loadRulesStatus = async () => {
    if (!teamId) return;
    
    setLoading(true);
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists()) {
        const teamData = teamDoc.data() as Team;
        
        let rulesExist = !!teamData.rules?.content;
        let conductExist = !!teamData.codeOfConduct?.content;
        let fromLeague = false;
        
        // Check if team is in a league
        if (teamData.leagueId && teamData.leagueStatus === 'active') {
          setLeagueId(teamData.leagueId);
          const leagueDoc = await getDoc(doc(db, 'leagues', teamData.leagueId));
          if (leagueDoc.exists()) {
            const leagueData = leagueDoc.data() as League;
            // League rules take precedence
            if (leagueData.rules?.content) {
              rulesExist = true;
              fromLeague = true;
            }
            if (leagueData.codeOfConduct?.content) {
              conductExist = true;
              fromLeague = true;
            }
          }
        }
        
        setHasRules(rulesExist);
        setHasConduct(conductExist);
        setIsFromLeague(fromLeague);
      }
    } catch (err) {
      console.error('Error loading rules status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't show anything if no rules exist and user can't edit
  if (!loading && !hasRules && !hasConduct && !canEditTeamRules) {
    return null;
  }

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2">
          {(hasRules || canEditTeamRules) && (
            <button
              onClick={() => setShowRulesModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/10 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              <FileText size={14} />
              <span>Rules</span>
              {isFromLeague && <BookOpen size={12} className="text-purple-400" />}
            </button>
          )}
          {(hasConduct || canEditTeamRules) && (
            <button
              onClick={() => setShowConductModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/10 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              <Shield size={14} />
              <span>Conduct</span>
              {isFromLeague && <BookOpen size={12} className="text-purple-400" />}
            </button>
          )}
        </div>

        {/* Modals */}
        <RulesModal
          isOpen={showRulesModal}
          onClose={() => setShowRulesModal(false)}
          teamId={teamId}
          canEdit={isFromLeague ? canEditLeagueRules : canEditTeamRules}
          type="rules"
        />
        <RulesModal
          isOpen={showConductModal}
          onClose={() => setShowConductModal(false)}
          teamId={teamId}
          canEdit={isFromLeague ? canEditLeagueRules : canEditTeamRules}
          type="codeOfConduct"
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={18} className="text-orange-400" />
          <h3 className="text-white font-semibold">Team Information</h3>
          {isFromLeague && (
            <span className="text-xs text-purple-400 flex items-center gap-1 ml-auto">
              <BookOpen size={12} /> League Policies
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
            Loading...
          </div>
        ) : (
          <div className="space-y-2">
            {/* Rules Button */}
            {(hasRules || canEditTeamRules) && (
              <button
                onClick={() => setShowRulesModal(true)}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                    <FileText size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">Rules</p>
                    <p className="text-xs text-slate-400">
                      {hasRules ? 'View team rules' : 'No rules added yet'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors" />
              </button>
            )}

            {/* Code of Conduct Button */}
            {(hasConduct || canEditTeamRules) && (
              <button
                onClick={() => setShowConductModal(true)}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                    <Shield size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">Code of Conduct</p>
                    <p className="text-xs text-slate-400">
                      {hasConduct ? 'View conduct guidelines' : 'No guidelines added yet'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-500 group-hover:text-white transition-colors" />
              </button>
            )}

            {!hasRules && !hasConduct && !canEditTeamRules && (
              <p className="text-sm text-slate-500 text-center py-2">
                No team policies available
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <RulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        teamId={teamId}
        canEdit={isFromLeague ? canEditLeagueRules : canEditTeamRules}
        type="rules"
      />
      <RulesModal
        isOpen={showConductModal}
        onClose={() => setShowConductModal(false)}
        teamId={teamId}
        canEdit={isFromLeague ? canEditLeagueRules : canEditTeamRules}
        type="codeOfConduct"
      />
    </>
  );
};

export default TeamRulesInfo;
