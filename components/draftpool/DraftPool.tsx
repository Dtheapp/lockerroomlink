/**
 * DraftPool Component
 * Displays the team's draft pool (waitlist) on the dashboard
 * 
 * - Visible to: Parents, Athletes, Coaches, Commissioners
 * - Payment info: Only visible to Coaches and Commissioners
 * - Draft actions: Only available to Coaches and Commissioners
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { calculateAgeGroup } from '../../services/ageValidator';
import { 
  subscribeToDraftPool, 
  draftToRoster, 
  declineDraftEntry,
  updateDraftPoolPayment,
  getTeamsForDrafting,
} from '../../services/draftPoolService';
import type { DraftPoolEntry, SportType } from '../../types';
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CreditCard,
  Banknote,
  Shield,
  Trophy,
  AtSign,
  ExternalLink,
} from 'lucide-react';

interface DraftPoolProps {
  teamId: string;
  teamOwnerId: string;
  sport: SportType;
  ageGroup: string;
  registrationCloseDate?: Date | null; // If set, Draft is disabled until this date passes
}

const DraftPool: React.FC<DraftPoolProps> = ({ teamId, teamOwnerId, sport, ageGroup, registrationCloseDate }) => {
  const { userData } = useAuth();
  const { theme } = useTheme();
  
  const [entries, setEntries] = useState<DraftPoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // For multi-team drafting
  const [showTeamSelector, setShowTeamSelector] = useState<string | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Array<{ id: string; name: string; playerCount: number }>>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  
  // Role checks
  const isCoach = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  const isCommissioner = userData?.uid === teamOwnerId || 
                         userData?.role === 'TeamCommissioner' || 
                         userData?.role === 'ProgramCommissioner' ||
                         userData?.role === 'SuperAdmin';
  const canDraft = isCoach || isCommissioner;
  
  // Check if registration is still open (Draft disabled until closed)
  const registrationStillOpen = registrationCloseDate && new Date() < registrationCloseDate;
  const canDraftNow = canDraft && !registrationStillOpen;
  const canSeePayment = canDraft;
  
  // Subscribe to draft pool updates
  useEffect(() => {
    if (!teamId) return;
    
    setLoading(true);
    const unsubscribe = subscribeToDraftPool(teamId, (poolEntries) => {
      setEntries(poolEntries);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [teamId]);
  
  // Handle drafting a player
  const handleDraft = async (entryId: string, targetTeamId?: string) => {
    if (!userData?.uid) return;
    
    setActionLoading(entryId);
    setError(null);
    setSuccess(null);
    
    const result = await draftToRoster(teamId, entryId, userData.uid, targetTeamId);
    
    setActionLoading(null);
    setShowTeamSelector(null);
    
    if (result.success) {
      setSuccess('Player added to roster!');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to draft player');
      setTimeout(() => setError(null), 5000);
    }
  };
  
  // Handle declining a player
  const handleDecline = async (entryId: string) => {
    if (!userData?.uid) return;
    
    setActionLoading(entryId);
    setError(null);
    setSuccess(null);
    
    const result = await declineDraftEntry(
      teamId, 
      entryId, 
      'Declined by team',
      userData.uid,
      userData.name || 'Coach'
    );
    
    setActionLoading(null);
    
    if (result.success) {
      setSuccess('Player declined. Parent has been notified.');
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || 'Failed to decline player');
      setTimeout(() => setError(null), 5000);
    }
  };
  
  // Load available teams for multi-team drafting
  const handleShowTeamSelector = async (entryId: string) => {
    if (showTeamSelector === entryId) {
      setShowTeamSelector(null);
      return;
    }
    
    setShowTeamSelector(entryId);
    setLoadingTeams(true);
    
    const teams = await getTeamsForDrafting(teamOwnerId, sport, ageGroup);
    setAvailableTeams(teams);
    setLoadingTeams(false);
  };
  
  // Get payment status badge
  const getPaymentBadge = (entry: DraftPoolEntry) => {
    const badges: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      paid_full: {
        label: 'Paid in Full',
        className: theme === 'dark' 
          ? 'bg-green-500/20 text-green-400 border-green-500/30' 
          : 'bg-green-100 text-green-700 border-green-200',
        icon: <CheckCircle2 className="w-3 h-3" />,
      },
      paid_partial: {
        label: `Partial ($${(entry.amountPaid / 100).toFixed(0)} / $${(entry.totalAmount / 100).toFixed(0)})`,
        className: theme === 'dark' 
          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
          : 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <CreditCard className="w-3 h-3" />,
      },
      pay_in_person: {
        label: 'Pay in Person',
        className: theme === 'dark' 
          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
          : 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <Banknote className="w-3 h-3" />,
      },
      pending: {
        label: 'Pending',
        className: theme === 'dark' 
          ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' 
          : 'bg-gray-100 text-gray-600 border-gray-200',
        icon: <Clock className="w-3 h-3" />,
      },
    };
    
    const badge = badges[entry.paymentStatus] || badges.pending;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${badge.className}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };
  
  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  if (loading) {
    return (
      <div className={`rounded-2xl border p-4 ${
        theme === 'dark' ? 'bg-zinc-800/50 border-white/10' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }
  
  if (entries.length === 0) {
    return null; // Don't show if no entries
  }
  
  return (
    <div className={`rounded-2xl border overflow-hidden ${
      theme === 'dark' ? 'bg-zinc-800/50 border-white/10' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-4 py-3 flex items-center justify-between transition ${
          theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
          }`}>
            <Trophy className={`w-5 h-5 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`} />
          </div>
          <div className="text-left">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              Draft Pool
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {entries.length} player{entries.length !== 1 ? 's' : ''} waiting
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
        ) : (
          <ChevronDown className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
        )}
      </button>
      
      {/* Content */}
      {expanded && (
        <div className={`border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
          {/* Success/Error Messages */}
          {success && (
            <div className={`mx-4 mt-3 p-3 rounded-lg flex items-center gap-2 ${
              theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
            }`}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}
          
          {error && (
            <div className={`mx-4 mt-3 p-3 rounded-lg flex items-center gap-2 ${
              theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {/* Player List */}
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                        {entry.playerName}
                      </span>
                      {/* Username - clickable to public profile */}
                      {(entry as any).playerUsername && (
                        <a
                          href={`/athlete/${(entry as any).playerUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                            theme === 'dark' 
                              ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          }`}
                        >
                          <AtSign className="w-3 h-3" />
                          {(entry as any).playerUsername}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {/* Age Group Badge */}
                      {entry.playerDob && calculateAgeGroup(entry.playerDob) && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {calculateAgeGroup(entry.playerDob)}
                        </span>
                      )}
                      {entry.playerDob && !calculateAgeGroup(entry.playerDob) && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          theme === 'dark' ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          18+
                        </span>
                      )}
                      {entry.isIndependentAthlete && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                        }`}>
                          Adult
                        </span>
                      )}
                      {canSeePayment && getPaymentBadge(entry)}
                    </div>
                    
                    <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {entry.isIndependentAthlete ? 'Self-registered' : `Parent: ${entry.contactName}`}
                      {entry.createdAt && ` • Joined ${formatDate(entry.createdAt)}`}
                    </div>
                    
                    {/* Preferred positions */}
                    {entry.preferredPositions && entry.preferredPositions.length > 0 && (
                      <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        Positions: {entry.preferredPositions.join(', ')}
                      </div>
                    )}
                    
                    {/* Parent Suggestions/Notes (visible to coaches/commissioners) */}
                    {canSeePayment && entry.notes && (
                      <div className={`mt-3 p-3 rounded-lg border ${
                        theme === 'dark' 
                          ? 'bg-purple-500/10 border-purple-500/20' 
                          : 'bg-purple-50 border-purple-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm">💬</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold mb-1 ${
                              theme === 'dark' ? 'text-purple-400' : 'text-purple-700'
                            }`}>
                              Parent Suggestions
                            </p>
                            <p className={`text-sm leading-relaxed ${
                              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                              {entry.notes}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions (Coach/Commissioner only) */}
                  {canDraft && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Multi-team selector */}
                      {availableTeams.length > 1 && showTeamSelector === entry.id ? (
                        <div className={`absolute right-4 mt-10 z-10 rounded-lg shadow-xl border ${
                          theme === 'dark' ? 'bg-zinc-800 border-white/20' : 'bg-white border-slate-200'
                        }`}>
                          {loadingTeams ? (
                            <div className="p-4">
                              <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                          ) : (
                            <div className="p-2">
                              <p className={`text-xs font-medium px-2 py-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                                Select team:
                              </p>
                              {availableTeams.map((team) => (
                                <button
                                  key={team.id}
                                  onClick={() => handleDraft(entry.id, team.id)}
                                  disabled={actionLoading === entry.id}
                                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                                    theme === 'dark' 
                                      ? 'hover:bg-white/10 text-white' 
                                      : 'hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {team.name} ({team.playerCount} players)
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                      
                      {/* Draft Button - Disabled if registration still open */}
                      <button
                        onClick={() => availableTeams.length > 1 
                          ? handleShowTeamSelector(entry.id) 
                          : handleDraft(entry.id)
                        }
                        disabled={actionLoading === entry.id || registrationStillOpen}
                        title={registrationStillOpen ? `Draft opens after registration closes (${registrationCloseDate?.toLocaleDateString()})` : 'Add player to roster'}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
                          registrationStillOpen
                            ? theme === 'dark'
                              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : theme === 'dark'
                              ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                              : 'bg-green-100 hover:bg-green-200 text-green-700'
                        } ${actionLoading === entry.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {actionLoading === entry.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : registrationStillOpen ? (
                          <Clock className="w-4 h-4" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        {registrationStillOpen ? 'Pending' : 'Draft'}
                      </button>
                      
                      {/* Decline Button */}
                      <button
                        onClick={() => handleDecline(entry.id)}
                        disabled={actionLoading === entry.id}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition ${
                          theme === 'dark'
                            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                            : 'bg-red-100 hover:bg-red-200 text-red-700'
                        } ${actionLoading === entry.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <XCircle className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Info for non-coaches */}
          {!canDraft && (
            <div className={`px-4 py-3 border-t ${
              theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
            }`}>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                💡 Players in the draft pool are waiting to be added to the team roster by the coach or commissioner.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DraftPool;
