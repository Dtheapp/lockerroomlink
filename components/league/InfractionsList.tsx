/**
 * Infractions List Component
 * Displays and manages infractions for league/commissioner view
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  User,
  Shield,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getInfractionsByLeague, 
  updateInfraction, 
  resolveInfraction, 
  dismissInfraction 
} from '../../services/leagueService';
import { InfractionThreadChat } from '../referee/InfractionThreadChat';
import type { Infraction, InfractionStatus, InfractionSeverity } from '../../types';

interface InfractionsListProps {
  leagueId: string;
  programId?: string;
}

export const InfractionsList: React.FC<InfractionsListProps> = ({ leagueId, programId }) => {
  const { user, userData } = useAuth();
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InfractionStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<InfractionSeverity | 'all'>('all');
  
  // Selected infraction for viewing thread
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [showThreadModal, setShowThreadModal] = useState(false);

  useEffect(() => {
    if (leagueId) {
      loadInfractions();
    }
  }, [leagueId]);

  const loadInfractions = async () => {
    setLoading(true);
    try {
      const data = await getInfractionsByLeague(leagueId);
      setInfractions(data);
    } catch (err) {
      console.error('Error loading infractions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (infraction: Infraction) => {
    if (!user?.uid) return;
    try {
      await resolveInfraction(infraction.id, user.uid);
      loadInfractions();
    } catch (err) {
      console.error('Error resolving infraction:', err);
    }
  };

  const handleDismiss = async (infraction: Infraction) => {
    if (!user?.uid) return;
    try {
      await dismissInfraction(infraction.id, user.uid);
      loadInfractions();
    } catch (err) {
      console.error('Error dismissing infraction:', err);
    }
  };

  const handleStartReview = async (infraction: Infraction) => {
    if (!user?.uid) return;
    try {
      await updateInfraction(infraction.id, { 
        status: 'under_review',
        assignedTo: user.uid
      });
      loadInfractions();
    } catch (err) {
      console.error('Error updating infraction:', err);
    }
  };

  const openThread = (infraction: Infraction) => {
    setSelectedInfraction(infraction);
    setShowThreadModal(true);
  };

  // Filter infractions
  const filteredInfractions = infractions.filter(inf => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !inf.title.toLowerCase().includes(search) &&
        !inf.teamName?.toLowerCase().includes(search) &&
        !inf.description.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    
    // Status filter
    if (statusFilter !== 'all' && inf.status !== statusFilter) {
      return false;
    }
    
    // Severity filter
    if (severityFilter !== 'all' && inf.severity !== severityFilter) {
      return false;
    }
    
    return true;
  });

  const severityColors = {
    minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    major: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    severe: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const statusColors: Record<InfractionStatus, string> = {
    submitted: 'bg-blue-500/20 text-blue-400',
    under_review: 'bg-yellow-500/20 text-yellow-400',
    resolved: 'bg-green-500/20 text-green-400',
    dismissed: 'bg-slate-500/20 text-slate-400',
    appealed: 'bg-purple-500/20 text-purple-400',
  };

  const statusIcons: Record<InfractionStatus, React.ReactNode> = {
    submitted: <Clock size={14} />,
    under_review: <AlertTriangle size={14} />,
    resolved: <CheckCircle size={14} />,
    dismissed: <XCircle size={14} />,
    appealed: <AlertTriangle size={14} />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-red-400" /> 
            Infractions
          </h2>
          <p className="text-sm text-slate-400">
            {infractions.filter(i => i.status === 'submitted' || i.status === 'under_review').length} pending review
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InfractionStatus | 'all')}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="appealed">Appealed</option>
          </select>
          
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as InfractionSeverity | 'all')}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Severity</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="major">Major</option>
            <option value="severe">Severe</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : filteredInfractions.length === 0 ? (
        <div className="bg-zinc-800/50 rounded-xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No infractions found</p>
          <p className="text-sm text-slate-500 mt-1">
            {searchTerm || statusFilter !== 'all' || severityFilter !== 'all' 
              ? 'Try adjusting your filters'
              : 'Infractions reported by referees will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInfractions.map((infraction) => (
            <div
              key={infraction.id}
              className="bg-zinc-800/50 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${severityColors[infraction.severity]}`}>
                      {infraction.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[infraction.status]}`}>
                      {statusIcons[infraction.status]}
                      {infraction.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date((infraction.createdAt as any)?.toDate?.() || infraction.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Title & Team */}
                  <h3 className="text-white font-semibold">{infraction.title}</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    <span className="text-orange-400">{infraction.teamName}</span>
                    {infraction.category && ` • ${infraction.category.replace('_', ' ')}`}
                  </p>
                  
                  {/* Description preview */}
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                    {infraction.description}
                  </p>
                  
                  {/* Reported by */}
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <User size={12} />
                    Reported by {infraction.reportedByName || 'Referee'}
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => openThread(infraction)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                  >
                    <MessageCircle size={14} />
                    View Thread
                  </button>
                  
                  {infraction.status === 'submitted' && (
                    <button
                      onClick={() => handleStartReview(infraction)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg text-sm transition-colors"
                    >
                      Start Review
                    </button>
                  )}
                  
                  {(infraction.status === 'submitted' || infraction.status === 'under_review') && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleResolve(infraction)}
                        className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-sm transition-colors"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => handleDismiss(infraction)}
                        className="px-3 py-1.5 bg-slate-600/20 hover:bg-slate-600/30 text-slate-400 rounded-lg text-sm transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Involved parties */}
              {(infraction.involvedPlayers?.length || infraction.involvedCoaches?.length || infraction.involvedParents?.length) && (
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                  {infraction.involvedPlayers?.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">
                      #{p.number} {p.playerName}
                    </span>
                  ))}
                  {infraction.involvedCoaches?.map((c, i) => (
                    <span key={i} className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs">
                      Coach: {c.coachName}
                    </span>
                  ))}
                  {infraction.involvedParents?.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded text-xs">
                      Parent: {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Thread Modal */}
      {selectedInfraction && (
        <InfractionThreadChat
          isOpen={showThreadModal}
          onClose={() => {
            setShowThreadModal(false);
            setSelectedInfraction(null);
          }}
          infractionId={selectedInfraction.id}
          threadId={selectedInfraction.chatThreadId || ''}
          userRole="league"
        />
      )}
    </div>
  );
};

export default InfractionsList;
