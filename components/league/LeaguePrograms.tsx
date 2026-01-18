import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Program, Team } from '../../types';
import { ChevronLeft, Search, Users, Building2, MapPin, Filter, MoreVertical, Check, X, Mail, AlertCircle, Loader2, Plus, Send, Eye, Calendar, Shield, Clock, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toastSuccess, toastError, toastWarning, toastInfo } from '../../services/toast';

// Join request interface
interface JoinRequest {
  id: string;
  programId: string;
  programName: string;
  leagueId: string;
  sport: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  createdByName: string;
  createdAt: any;
  message?: string;
}

export default function LeaguePrograms() {
  const { leagueData, user } = useAuth();
  const { theme } = useTheme();
  const [programs, setPrograms] = useState<(Program & { teamCount?: number; hasUnplayedGames?: boolean; teams?: Team[] })[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [detailProgram, setDetailProgram] = useState<(Program & { teams?: Team[] }) | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  useEffect(() => {
    loadPrograms();
    loadJoinRequests();
  }, [leagueData]);
  
  // Load pending join requests
  const loadJoinRequests = async () => {
    if (!leagueData?.id) return;
    
    try {
      const q = query(
        collection(db, 'leagueRequests'),
        where('leagueId', '==', leagueData.id),
        where('type', '==', 'join_request'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as JoinRequest[];
      setJoinRequests(requests);
    } catch (error) {
      console.error('Error loading join requests:', error);
    }
  };
  
  // Accept join request
  const handleAcceptJoinRequest = async (request: JoinRequest) => {
    setProcessingRequest(request.id);
    try {
      // Update request status
      await updateDoc(doc(db, 'leagueRequests', request.id), {
        status: 'approved',
        respondedAt: serverTimestamp(),
        respondedBy: user?.uid
      });
      
      // Update the program to be part of this league
      const sportKey = request.sport?.toLowerCase() || leagueData?.sport?.toLowerCase() || 'football';
      await updateDoc(doc(db, 'programs', request.programId), {
        leagueId: leagueData?.id,
        [`leagueIds.${sportKey}`]: leagueData?.id,
        leagueName: leagueData?.name,
        leagueJoinedAt: serverTimestamp(),
        leagueStatus: 'active'
      });
      
      // Notify the program commissioner
      await addDoc(collection(db, 'notifications'), {
        userId: request.createdBy,
        type: 'join_request_approved',
        title: 'League Request Approved!',
        message: `Your request to join ${leagueData?.name} has been approved.`,
        read: false,
        createdAt: serverTimestamp(),
        data: {
          leagueId: leagueData?.id,
          leagueName: leagueData?.name,
          programId: request.programId
        }
      });
      
      toastSuccess(`${request.programName} has been added to the league!`);
      setJoinRequests(prev => prev.filter(r => r.id !== request.id));
      loadPrograms(); // Refresh programs list
    } catch (error) {
      console.error('Error accepting join request:', error);
      toastError('Failed to accept request');
    } finally {
      setProcessingRequest(null);
    }
  };
  
  // Decline join request
  const handleDeclineJoinRequest = async (request: JoinRequest) => {
    setProcessingRequest(request.id);
    try {
      await updateDoc(doc(db, 'leagueRequests', request.id), {
        status: 'rejected',
        respondedAt: serverTimestamp(),
        respondedBy: user?.uid
      });
      
      // Notify the program commissioner
      await addDoc(collection(db, 'notifications'), {
        userId: request.createdBy,
        type: 'join_request_declined',
        title: 'League Request Declined',
        message: `Your request to join ${leagueData?.name} was not approved.`,
        read: false,
        createdAt: serverTimestamp(),
        data: {
          leagueId: leagueData?.id,
          leagueName: leagueData?.name,
          programId: request.programId
        }
      });
      
      toastInfo('Request declined');
      setJoinRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error('Error declining join request:', error);
      toastError('Failed to decline request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const loadPrograms = async () => {
    if (!leagueData) return;

    try {
      const q = query(
        collection(db, 'programs'),
        where('leagueId', '==', leagueData.id)
      );
      const snapshot = await getDocs(q);
      const programsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Program[];
      
      // Load team counts for each program filtered by leagueId
      const programsWithCounts = await Promise.all(
        programsList.map(async (program) => {
          const teamsSnap = await getDocs(
            query(
              collection(db, 'teams'),
              where('programId', '==', program.id),
              where('leagueId', '==', leagueData.id)
            )
          );
          const teams = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Team[];
          
          // Check for unplayed games in leagueSchedules
          const schedulesSnap = await getDocs(
            query(
              collection(db, 'leagueSchedules'),
              where('leagueId', '==', leagueData.id)
            )
          );
          
          let hasUnplayedGames = false;
          const teamIds = teams.map(t => t.id);
          
          for (const schedDoc of schedulesSnap.docs) {
            const games = schedDoc.data().games || [];
            for (const game of games) {
              // Check if this program's teams are in any unplayed games
              if ((teamIds.includes(game.homeTeamId) || teamIds.includes(game.awayTeamId)) && 
                  game.status !== 'completed' && game.status !== 'cancelled') {
                hasUnplayedGames = true;
                break;
              }
            }
            if (hasUnplayedGames) break;
          }
          
          return { ...program, teamCount: teamsSnap.size, hasUnplayedGames, teams };
        })
      );
      
      setPrograms(programsWithCounts.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (programId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'programs', programId), {
        status: newStatus,
        updatedAt: new Date()
      });
      setPrograms(programs.map(p => 
        p.id === programId ? { ...p, status: newStatus as any } : p
      ));
      setSelectedProgram(null);
    } catch (error) {
      console.error('Error updating program status:', error);
    }
  };

  const handleRemoveProgram = async (programId: string) => {
    if (!confirm('Are you sure you want to remove this program from your league?')) return;

    try {
      await updateDoc(doc(db, 'programs', programId), {
        leagueId: null,
        status: 'inactive',
        updatedAt: new Date()
      });
      setPrograms(programs.filter(p => p.id !== programId));
    } catch (error) {
      console.error('Error removing program:', error);
    }
  };

  const filteredPrograms = programs.filter(program => {
    const matchesSearch = program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (program as any).status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

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
                <Building2 className={theme === 'dark' ? 'w-5 h-5 text-purple-400' : 'w-5 h-5 text-purple-600'} />
                Programs
              </h1>
              <p className={theme === 'dark' ? 'text-sm text-slate-400' : 'text-sm text-slate-600'}>{programs.length} programs in {leagueData.name}</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 px-4 py-2 rounded-xl font-medium text-white transition-all shadow-lg shadow-purple-500/25"
            >
              <Plus className="w-5 h-5" />
              Invite Program
            </button>
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
              placeholder="Search programs..."
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
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Join Requests Section */}
        {joinRequests.length > 0 && (
          <div className={`rounded-2xl border mb-6 overflow-hidden ${
            theme === 'dark'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className={`px-5 py-3 flex items-center justify-between border-b ${
              theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-100 border-amber-200'
            }`}>
              <h3 className={`font-medium flex items-center gap-2 ${
                theme === 'dark' ? 'text-amber-300' : 'text-amber-800'
              }`}>
                <Inbox className="w-5 h-5" />
                Join Requests
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  theme === 'dark' ? 'bg-amber-500 text-black' : 'bg-amber-500 text-white'
                }`}>
                  {joinRequests.length}
                </span>
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {joinRequests.map(request => (
                <div 
                  key={request.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    theme === 'dark'
                      ? 'bg-white/5 border-white/10'
                      : 'bg-white border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
                    }`}>
                      <Building2 className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {request.programName}
                      </p>
                      <p className={`text-xs flex items-center gap-1 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        <Clock className="w-3 h-3" />
                        Requested by {request.createdByName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeclineJoinRequest(request)}
                      disabled={processingRequest === request.id}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-red-500/20 text-red-400'
                          : 'hover:bg-red-100 text-red-600'
                      } disabled:opacity-50`}
                    >
                      {processingRequest === request.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <X className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleAcceptJoinRequest(request)}
                      disabled={processingRequest === request.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        theme === 'dark'
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      } disabled:opacity-50`}
                    >
                      {processingRequest === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Accept
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className={`text-center py-12 rounded-2xl border ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Building2 className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
            }`} />
            <h3 className={`text-lg font-medium ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>No Programs Found</h3>
            <p className={`mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'No programs have joined your league yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPrograms.map(program => (
              <div key={program.id} className={`rounded-2xl p-5 border transition-colors ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 hover:border-white/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className={`font-semibold text-lg ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>{(program as any).sportNames?.[leagueData?.sport || ''] || program.name}</h3>
                      <div className={`flex items-center gap-3 mt-1 text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {program.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {program.city}, {program.state}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {(program as any).teamCount || 0} teams
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor((program as any).leagueStatus || 'active')}`}>
                          {(program as any).leagueStatus || 'Active'}
                        </span>
                        {program.sport && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            theme === 'dark' 
                              ? 'bg-white/10 text-slate-300' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {program.sport.charAt(0).toUpperCase() + program.sport.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={() => setSelectedProgram(selectedProgram === program.id ? null : program.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                      }`}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    
                    {selectedProgram === program.id && (
                      <div className={`absolute right-0 top-full mt-1 w-48 rounded-xl shadow-lg border py-1 z-10 ${
                        theme === 'dark'
                          ? 'bg-zinc-800 border-white/10'
                          : 'bg-white border-slate-200'
                      }`}>
                        <button
                          onClick={() => {
                            setDetailProgram(program as any);
                            setSelectedProgram(null);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                        <button
                          onClick={() => handleStatusChange(program.id, 'active')}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          }`}
                        >
                          <Check className="w-4 h-4 text-green-400" />
                          Set Active
                        </button>
                        <button
                          onClick={() => handleStatusChange(program.id, 'inactive')}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          }`}
                        >
                          <X className="w-4 h-4 text-yellow-400" />
                          Set Inactive
                        </button>
                        <button
                          onClick={() => {
                            const email = (program as any).contactEmail;
                            if (email) {
                              window.location.href = `mailto:${email}`;
                            } else {
                              toastInfo('No contact email available for this program');
                            }
                            setSelectedProgram(null);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          }`}
                        >
                          <Mail className="w-4 h-4" />
                          Contact
                        </button>
                        <hr className={`my-1 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`} />
                        <button
                          onClick={() => {
                            if ((program as any).hasUnplayedGames) {
                              toastError('Cannot remove program while there are unplayed games scheduled. Delete or complete games first.');
                              setSelectedProgram(null);
                              return;
                            }
                            handleRemoveProgram(program.id);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${
                            (program as any).hasUnplayedGames 
                              ? 'text-slate-500 cursor-not-allowed' 
                              : 'text-red-400'
                          } ${
                            theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                          }`}
                        >
                          <X className="w-4 h-4" />
                          Remove from League
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Program Modal */}
      {showInviteModal && (
        <InviteProgramModal
          leagueId={leagueData.id!}
          leagueName={leagueData.name}
          leagueSport={leagueData.sport || 'football'}
          existingProgramIds={programs.map(p => p.id!)}
          theme={theme}
          onClose={() => setShowInviteModal(false)}
          onInvited={() => {
            setShowInviteModal(false);
            loadPrograms();
          }}
        />
      )}

      {/* Program Details Modal */}
      {detailProgram && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-lg rounded-2xl overflow-hidden ${
            theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              theme === 'dark' ? 'border-white/10' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {(detailProgram as any).sportNames?.[leagueData?.sport || ''] || detailProgram.name}
                  </h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {detailProgram.city}, {detailProgram.state}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailProgram(null)}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                }`}
              >
                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`} />
              </button>
            </div>
            
            <div className="p-6">
              <h3 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                Teams in League ({(detailProgram as any).teams?.length || 0})
              </h3>
              
              {(detailProgram as any).teams?.length === 0 ? (
                <div className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No teams from this program in the league yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(detailProgram as any).teams?.map((team: Team) => (
                    <div key={team.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                      theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'
                    }`}>
                      {team.logo ? (
                        <img src={team.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                        }`}>
                          <Shield className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                          {team.name}
                        </p>
                        {team.ageGroup && (
                          <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                            {team.ageGroup}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {(detailProgram as any).contactEmail && (
                <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Mail className="w-4 h-4 inline mr-2" />
                    {(detailProgram as any).contactEmail}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Invite Program Modal Component
interface InviteProgramModalProps {
  leagueId: string;
  leagueName: string;
  leagueSport: string;
  existingProgramIds: string[];
  theme: 'dark' | 'light';
  onClose: () => void;
  onInvited: () => void;
}

function InviteProgramModal({ leagueId, leagueName, leagueSport, existingProgramIds, theme, onClose, onInvited }: InviteProgramModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<(Program & { sportSpecificName?: string; currentLeagueName?: string })[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);

  // Load existing pending invites
  useEffect(() => {
    const loadPendingInvites = async () => {
      try {
        const q = query(
          collection(db, 'leagueRequests'),
          where('leagueId', '==', leagueId),
          where('status', '==', 'pending'),
          where('type', '==', 'league_invitation')
        );
        const snap = await getDocs(q);
        setPendingInvites(snap.docs.map(d => d.data().programId));
      } catch (error) {
        console.error('Error loading pending invites:', error);
      }
    };
    loadPendingInvites();
  }, [leagueId]);

  // Auto-search with debounce
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 300); // 300ms debounce
    
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setSearching(true);
    try {
      // Search by name (case-insensitive via client-side filter)
      const q = query(
        collection(db, 'programs'),
        limit(50)
      );
      const snap = await getDocs(q);
      
      // Normalize league sport for lookup (try both cases)
      const sportKey = leagueSport.charAt(0).toUpperCase() + leagueSport.slice(1).toLowerCase();
      const sportKeyLower = leagueSport.toLowerCase();
      
      const results = snap.docs
        .map(d => {
          const data = d.data();
          // Get sport-specific name if available (check both cases)
          // Field is called 'sportNames' not 'sportSpecificNames'
          const sportNames = data.sportNames || {};
          const sportSpecificName = sportNames[sportKey] || sportNames[sportKeyLower] || sportNames[leagueSport] || null;
          
          // Also get all sport names for searching
          const allSportNames = Object.values(sportNames).filter(Boolean).join(' ').toLowerCase();
          
          return { 
            id: d.id, 
            ...data,
            sportSpecificName,
            allSportNames,
            currentLeagueName: data.leagueName || null
          } as Program & { sportSpecificName?: string; allSportNames?: string; currentLeagueName?: string };
        })
        .filter(p => {
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = 
            p.name.toLowerCase().includes(searchLower) ||
            p.city?.toLowerCase().includes(searchLower) ||
            p.state?.toLowerCase().includes(searchLower) ||
            (p.sportSpecificName && p.sportSpecificName.toLowerCase().includes(searchLower)) ||
            (p.allSportNames && p.allSportNames.includes(searchLower));
          
          return matchesSearch;
        });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching programs:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (program: Program & { sportSpecificName?: string; currentLeagueName?: string }) => {
    // Don't allow if already in league
    if (existingProgramIds.includes(program.id!)) {
      toastError('This program is already in your league');
      return;
    }
    
    // Don't allow if already has pending invite
    if (pendingInvites.includes(program.id!)) {
      toastError('Invitation already pending for this program');
      return;
    }
    
    setInviting(program.id!);
    try {
      const isSwitchLeague = !!program.currentLeagueName;
      
      // Create a league invitation request
      await addDoc(collection(db, 'leagueRequests'), {
        type: 'league_invitation',
        leagueId,
        leagueName,
        programId: program.id,
        programName: program.name,
        sportSpecificName: program.sportSpecificName || null,
        status: 'pending',
        createdAt: serverTimestamp(),
        createdBy: 'league_owner',
        isSwitchLeague, // If they're switching from another league
        previousLeagueName: program.currentLeagueName || null,
        message: isSwitchLeague 
          ? `${leagueName} has invited your program to switch to their league.`
          : `${leagueName} has invited your program to join their league.`
      });

      // Create notification for program commissioner
      // Role can be 'Commissioner', 'ProgramCommissioner', or user has commissionerType='program'
      const programDoc = await getDocs(query(
        collection(db, 'users'),
        where('programId', '==', program.id)
      ));
      
      // Filter to find commissioner (check multiple role possibilities)
      const commissioners = programDoc.docs.filter(d => {
        const data = d.data();
        return data.role === 'Commissioner' || 
               data.role === 'ProgramCommissioner' || 
               data.commissionerType === 'program';
      });
      
      if (commissioners.length > 0) {
        const commissionerId = commissioners[0].id;
        await addDoc(collection(db, 'notifications'), {
          userId: commissionerId,
          type: 'league_invitation',
          title: isSwitchLeague ? 'League Switch Invitation' : 'League Invitation',
          message: isSwitchLeague 
            ? `${leagueName} has invited your program to switch to their league.`
            : `${leagueName} has invited your program to join their league.`,
          read: false,
          createdAt: serverTimestamp(),
          data: {
            leagueId,
            leagueName,
            programId: program.id,
            isSwitchLeague
          }
        });
      }

      setPendingInvites([...pendingInvites, program.id!]);
      setShowSuccessMessage(program.name);
      
      // Clear success message after 3 seconds
      setTimeout(() => setShowSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error sending invitation:', error);
      toastError('Failed to send invitation');
    } finally {
      setInviting(null);
    }
  };

  // Get display status for a program
  const getProgramStatus = (program: Program & { sportSpecificName?: string; currentLeagueName?: string }) => {
    if (existingProgramIds.includes(program.id!)) {
      return { label: 'Already in your league', color: 'bg-green-500/20 text-green-400', disabled: true };
    }
    if (pendingInvites.includes(program.id!)) {
      return { label: 'Invitation pending', color: 'bg-amber-500/20 text-amber-400', disabled: true };
    }
    if (program.currentLeagueName) {
      return { label: `In ${program.currentLeagueName}`, color: 'bg-blue-500/20 text-blue-400', disabled: false };
    }
    return { label: 'No league', color: 'bg-slate-500/20 text-slate-400', disabled: false };
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col ${
        theme === 'dark'
          ? 'bg-zinc-900 border border-white/10'
          : 'bg-white border border-slate-200 shadow-xl'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b shrink-0 ${
          theme === 'dark' ? 'border-white/10' : 'border-slate-200'
        }`}>
          <h2 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>Invite Program to League</h2>
          <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${
            theme === 'dark' ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Success Message */}
        {showSuccessMessage && (
          <div className={`mx-4 mt-4 p-3 rounded-xl flex items-start gap-3 ${
            theme === 'dark' ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-50 border border-green-200'
          }`}>
            <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className={`font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                Invitation Sent!
              </p>
              <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-green-400/80' : 'text-green-600'}`}>
                The program commissioner will review your request. You can track pending invitations in the <Link to="/league/requests" className="underline font-medium" onClick={onClose}>Requests</Link> area.
              </p>
            </div>
          </div>
        )}
        
        {/* Search */}
        <div className="p-4 shrink-0">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`} />
            <input
              type="text"
              placeholder="Start typing to search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className={`w-full rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500'
                  : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-purple-500" />
            )}
          </div>
          {searchTerm.length > 0 && searchTerm.length < 2 && (
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Type at least 2 characters to search
            </p>
          )}
        </div>
        
        {/* Results */}
        <div className={`flex-1 overflow-y-auto px-4 pb-4 ${
          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {searchResults.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className={`w-12 h-12 mx-auto mb-3 ${
                theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
              }`} />
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                {searchTerm.length >= 2 && !searching ? 'No programs found. Try a different search.' : 'Start typing to search for programs'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map(program => {
                const status = getProgramStatus(program);
                
                return (
                  <div 
                    key={program.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      status.disabled
                        ? theme === 'dark'
                          ? 'bg-white/5 border-white/5 opacity-60'
                          : 'bg-slate-50 border-slate-100 opacity-60'
                        : theme === 'dark'
                          ? 'bg-white/5 border-white/10 hover:border-white/20'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Primary: Sport-specific name OR program name */}
                          <p className={`font-medium truncate ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}>
                            {program.sportSpecificName || program.name}
                          </p>
                          
                          {/* Sport badge */}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                              theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                            }`}>
                              {leagueSport}
                            </span>
                            {/* Show org name if different from display name */}
                            {program.sportSpecificName && program.sportSpecificName !== program.name && (
                              <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                ({program.name})
                              </span>
                            )}
                          </div>
                          
                          <p className={`text-sm truncate mt-0.5 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {program.city && `${program.city}, ${program.state}`}
                          </p>
                          
                          {/* League Status Badge */}
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full mt-1 ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                      
                      {!status.disabled && (
                        <button
                          onClick={() => handleInvite(program)}
                          disabled={inviting === program.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                            program.currentLeagueName
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          } disabled:opacity-50`}
                        >
                          {inviting === program.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              {program.currentLeagueName ? 'Suggest Switch' : 'Invite'}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
