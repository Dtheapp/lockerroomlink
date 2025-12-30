import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LeagueRequest } from '../../types';
import { updateLeagueRequest } from '../../services/leagueService';
import { ChevronLeft, Search, Inbox, Check, X, Clock, Filter, AlertCircle, Loader2, Users, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LeagueRequests() {
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const [requests, setRequests] = useState<LeagueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadRequests();
  }, [leagueData]);

  const loadRequests = async () => {
    if (!leagueData) return;

    try {
      const q = query(
        collection(db, 'leagueRequests'),
        where('leagueId', '==', leagueData.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const requestsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeagueRequest[];
      
      setRequests(requestsList);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!user) return;
    
    setProcessingId(requestId);
    try {
      await updateLeagueRequest(requestId, 'approved', user.uid);
      setRequests(requests.map(r => 
        r.id === requestId ? { ...r, status: 'approved' } : r
      ));
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string, reason: string) => {
    if (!user) return;
    
    setProcessingId(requestId);
    try {
      await updateLeagueRequest(requestId, 'denied', user.uid, reason);
      setRequests(requests.map(r => 
        r.id === requestId ? { ...r, status: 'rejected' } : r
      ));
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      (request as any).programName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request as any).teamName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            <Check className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            <X className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (!leagueData) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-slate-50'
      }`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No League Found</h2>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>You are not associated with any league.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark' 
          ? 'bg-black/40 border-white/10' 
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/league" className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}>
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <h1 className={`text-xl font-bold flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Inbox className={theme === 'dark' ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-600'} />
                Join Requests
                {pendingCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">
                    {pendingCount}
                  </span>
                )}
              </h1>
              <p className={theme === 'dark' ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}>Manage requests to join {leagueData.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`} />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                  : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className={theme === 'dark' ? 'w-5 h-5 text-slate-400' : 'w-5 h-5 text-slate-500'} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white'
                  : 'bg-white border border-slate-200 text-slate-900'
              }`}
            >
              <option value="all">All Requests</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Inbox className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Requests Found</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'No join requests have been submitted yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map(request => (
              <div key={request.id} className={`rounded-2xl p-5 border ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${(request as any).type === 'league_invitation' ? 'bg-amber-500/20' : 'bg-purple-500/20'}`}>
                      {(request as any).type === 'league_invitation' 
                        ? <span className="text-2xl">📨</span>
                        : <Users className={theme === 'dark' ? 'w-6 h-6 text-purple-400' : 'w-6 h-6 text-purple-600'} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {(request as any).type === 'league_invitation' 
                            ? ((request as any).sportSpecificName || (request as any).programName || 'Program Invitation')
                            : (request.teamName || 'Team Request')}
                        </h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {(request as any).type === 'league_invitation'
                          ? ((request as any).createdBy === 'league_owner' 
                              ? 'You invited this program to join your league'
                              : 'Program wants to join your league')
                          : 'Team wants to join your league'}
                      </p>
                      <div className={`flex items-center gap-4 mt-2 text-sm ${
                        theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                      }`}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(request.createdAt)}
                        </span>
                      </div>
                      {(request as any).message && (
                        <p className={`mt-3 text-sm rounded-xl p-3 ${
                          theme === 'dark' 
                            ? 'text-slate-300 bg-white/5' 
                            : 'text-slate-600 bg-slate-50'
                        }`}>
                          "{(request as any).message}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Only show approve/reject for requests FROM programs, not invitations we sent */}
                  {request.status === 'pending' && (request as any).createdBy !== 'league_owner' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={processingId === request.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 rounded-xl text-sm font-medium text-white transition-colors"
                      >
                        {processingId === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Reason for rejection (optional):');
                          handleReject(request.id, reason || 'Request declined');
                        }}
                        disabled={processingId === request.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-xl text-sm font-medium text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                  
                  {/* Show status indicator for invitations we sent */}
                  {request.status === 'pending' && (request as any).createdBy === 'league_owner' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Awaiting Response
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
