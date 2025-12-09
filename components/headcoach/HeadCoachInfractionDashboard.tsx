/**
 * Head Coach Infraction Dashboard
 * Only visible to head coaches - shows team infractions and allows communication
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  MessageCircle, 
  Clock, 
  CheckCircle,
  XCircle,
  Filter,
  ChevronRight,
  Shield,
  AlertCircle,
  Eye
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getInfractionsByTeam } from '../../services/leagueService';
import { InfractionThreadChat } from '../referee/InfractionThreadChat';
import type { Infraction } from '../../types';

interface HeadCoachInfractionDashboardProps {
  teamId: string;
  teamName: string;
}

export const HeadCoachInfractionDashboard: React.FC<HeadCoachInfractionDashboardProps> = ({
  teamId,
  teamName,
}) => {
  const { user } = useAuth();
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'resolved' | 'dismissed'>('all');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    loadInfractions();
  }, [teamId]);

  const loadInfractions = async () => {
    setLoading(true);
    try {
      const data = await getInfractionsByTeam(teamId);
      setInfractions(data);
    } catch (err) {
      console.error('Error loading infractions:', err);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (infraction: Infraction) => {
    setSelectedInfraction(infraction);
    setChatOpen(true);
  };

  const filteredInfractions = filter === 'all' 
    ? infractions 
    : infractions.filter(i => i.status === filter);

  const severityColors = {
    minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    major: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    severe: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const statusColors = {
    submitted: 'bg-blue-500/20 text-blue-400',
    under_review: 'bg-yellow-500/20 text-yellow-400',
    resolved: 'bg-green-500/20 text-green-400',
    dismissed: 'bg-slate-500/20 text-slate-400',
    appealed: 'bg-purple-500/20 text-purple-400',
  };

  const statusIcons = {
    submitted: Clock,
    under_review: Eye,
    resolved: CheckCircle,
    dismissed: XCircle,
    appealed: AlertCircle,
  };

  const stats = {
    total: infractions.length,
    pending: infractions.filter(i => ['submitted', 'under_review', 'appealed'].includes(i.status)).length,
    resolved: infractions.filter(i => i.status === 'resolved').length,
    dismissed: infractions.filter(i => i.status === 'dismissed').length,
    severe: infractions.filter(i => i.severity === 'severe').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Team Infractions</h2>
              <p className="text-slate-400 text-sm">
                Review and respond to infractions reported against {teamName}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/5">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-slate-400">Total</div>
          </div>
          <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-xs text-yellow-400/70">Pending</div>
          </div>
          <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
            <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
            <div className="text-xs text-green-400/70">Resolved</div>
          </div>
          <div className="bg-slate-500/10 rounded-xl p-4 border border-slate-500/20">
            <div className="text-2xl font-bold text-slate-400">{stats.dismissed}</div>
            <div className="text-xs text-slate-400/70">Dismissed</div>
          </div>
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
            <div className="text-2xl font-bold text-red-400">{stats.severe}</div>
            <div className="text-xs text-red-400/70">Severe</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter size={16} className="text-slate-400 flex-shrink-0" />
        {(['all', 'submitted', 'under_review', 'resolved', 'dismissed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
              filter === status
                ? 'bg-orange-600 text-white'
                : 'bg-zinc-800 text-slate-300 hover:bg-zinc-700'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Infractions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : filteredInfractions.length === 0 ? (
          <div className="bg-zinc-900/50 rounded-xl border border-white/10 p-8 text-center">
            <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">
              {filter === 'all' 
                ? 'No infractions on record. Great job!' 
                : `No ${filter.replace('_', ' ')} infractions`}
            </p>
          </div>
        ) : (
          filteredInfractions.map((infraction) => {
            const StatusIcon = statusIcons[infraction.status];
            
            return (
              <div
                key={infraction.id}
                className="bg-zinc-900/80 rounded-xl border border-white/10 p-4 hover:border-orange-500/30 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${severityColors[infraction.severity]}`}>
                    <AlertTriangle size={18} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white truncate">{infraction.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[infraction.status]}`}>
                        {infraction.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                      {infraction.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className={`px-2 py-0.5 rounded border ${severityColors[infraction.severity]}`}>
                        {infraction.severity}
                      </span>
                      <span>{infraction.category}</span>
                      <span>
                        {new Date((infraction.createdAt as any)?.toDate?.() || infraction.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => openChat(infraction)}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-orange-600/20 hover:text-orange-400 text-slate-300 rounded-lg transition-colors group-hover:bg-orange-600/10"
                  >
                    <MessageCircle size={16} />
                    <span className="text-sm">Discuss</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Infraction Chat Modal */}
      {selectedInfraction && (
        <InfractionThreadChat
          isOpen={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setSelectedInfraction(null);
          }}
          infractionId={selectedInfraction.id}
          threadId={selectedInfraction.chatThreadId || ''}
          userRole="headcoach"
        />
      )}
    </div>
  );
};

export default HeadCoachInfractionDashboard;
