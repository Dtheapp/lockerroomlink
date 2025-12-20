/**
 * Commissioner Grievance Management Component
 * Allows commissioners to view and manage grievances/disputes
 */

import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  getGrievancesByProgram, 
  updateGrievance, 
  resolveGrievance 
} from '../../services/leagueService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Grievance, UserProfile, Team } from '../../types';
import { Timestamp } from 'firebase/firestore';
import { 
  Shield, 
  ChevronRight, 
  AlertTriangle, 
  Loader2, 
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  User,
  Users,
  Filter,
  Search
} from 'lucide-react';

// Helper to convert Timestamp/Date to Date
const toDate = (value: Timestamp | Date | undefined): Date => {
  if (!value) return new Date();
  if (value instanceof Timestamp) return value.toDate();
  return value;
};

const STATUS_CONFIG = {
  submitted: { label: 'New', color: 'bg-red-500/20 text-red-400', icon: AlertTriangle },
  under_review: { label: 'Under Review', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
  dismissed: { label: 'Dismissed', color: 'bg-gray-500/20 text-gray-400', icon: XCircle },
};

const GRIEVANCE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'player_eligibility', label: 'Player Eligibility' },
  { value: 'coach_conduct', label: 'Coach Conduct' },
  { value: 'parent_conduct', label: 'Parent Conduct' },
  { value: 'rule_violation', label: 'Rule Violation' },
  { value: 'safety_concern', label: 'Safety Concern' },
  { value: 'schedule_dispute', label: 'Schedule Dispute' },
  { value: 'other', label: 'Other' },
];

export const CommissionerGrievances: React.FC = () => {
  const { userData, programData } = useAuth();
  const { theme } = useTheme();
  
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [submitterInfo, setSubmitterInfo] = useState<UserProfile | null>(null);
  const [teamInfo, setTeamInfo] = useState<Team | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (!programData?.id) {
      setLoading(false);
      return;
    }

    const loadGrievances = async () => {
      try {
        const data = await getGrievancesByProgram(programData.id);
        setGrievances(data);
      } catch (error) {
        console.error('Error loading grievances:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGrievances();
  }, [programData?.id]);

  // Load submitter/team info when grievance is selected
  useEffect(() => {
    if (!selectedGrievance) {
      setSubmitterInfo(null);
      setTeamInfo(null);
      return;
    }

    const loadDetails = async () => {
      try {
        if (selectedGrievance.submittedBy) {
          const userDoc = await getDoc(doc(db, 'users', selectedGrievance.submittedBy));
          if (userDoc.exists()) {
            setSubmitterInfo({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
          }
        }
        if (selectedGrievance.teamId) {
          const teamDoc = await getDoc(doc(db, 'teams', selectedGrievance.teamId));
          if (teamDoc.exists()) {
            setTeamInfo({ id: teamDoc.id, ...teamDoc.data() } as Team);
          }
        }
      } catch (error) {
        console.error('Error loading details:', error);
      }
    };

    loadDetails();
  }, [selectedGrievance?.id]);

  const handleStatusChange = async (grievanceId: string, newStatus: string) => {
    if (!userData?.uid) return;
    setActionLoading(true);
    
    try {
      await updateGrievance(grievanceId, { status: newStatus as Grievance['status'] });
      
      setGrievances(prev => prev.map(g => 
        g.id === grievanceId ? { ...g, status: newStatus as Grievance['status'] } : g
      ));
      
      if (selectedGrievance?.id === grievanceId) {
        setSelectedGrievance(prev => prev ? { ...prev, status: newStatus as Grievance['status'] } : null);
      }
    } catch (error) {
      console.error('Error updating grievance:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedGrievance || !userData?.uid || !resolution.trim()) return;
    setActionLoading(true);
    
    try {
      await resolveGrievance(selectedGrievance.id!, userData.uid, resolution);
      
      setGrievances(prev => prev.map(g => 
        g.id === selectedGrievance.id ? { ...g, status: 'resolved', resolution } : g
      ));
      
      setSelectedGrievance(prev => prev ? { ...prev, status: 'resolved', resolution } : null);
      setResolution('');
    } catch (error) {
      console.error('Error resolving grievance:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter grievances
  const filteredGrievances = grievances.filter(g => {
    const matchesSearch = 
      g.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || g.type === filterType;
    const matchesStatus = filterStatus === 'all' || g.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-slate-100'}`}>
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-20 ${theme === 'dark' ? 'bg-gray-900' : 'bg-slate-100'}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/commissioner" className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}>
              <Shield className="w-5 h-5" />
            </Link>
            <ChevronRight className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Grievance Management</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Grievance List */}
          <div className="flex-1">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search grievances..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
              
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                {GRIEVANCE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* List */}
            {filteredGrievances.length === 0 ? (
              <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
                <AlertTriangle className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {grievances.length === 0 ? 'No Grievances' : 'No Results Found'}
                </h2>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}>
                  {grievances.length === 0 
                    ? 'No grievances have been submitted to your program yet.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGrievances.map((grievance) => {
                  const statusConfig = STATUS_CONFIG[grievance.status] || STATUS_CONFIG.submitted;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <button
                      key={grievance.id}
                      onClick={() => setSelectedGrievance(grievance)}
                      className={`w-full text-left border rounded-xl p-4 transition-all ${
                        selectedGrievance?.id === grievance.id 
                          ? 'border-purple-500' 
                          : theme === 'dark' 
                            ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 hover:border-gray-600'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-slate-500'}`}>
                              {grievance.type?.replace('_', ' ')}
                            </span>
                          </div>
                          <h3 className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{grievance.title}</h3>
                          <p className={`text-sm line-clamp-2 mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                            {grievance.description}
                          </p>
                          <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>
                            {toDate(grievance.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusConfig.color.split(' ')[1]}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedGrievance && (
            <div className={`lg:w-[400px] rounded-xl overflow-hidden sticky top-4 ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'
            }`}>
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Grievance Details</h2>
                  <button
                    onClick={() => setSelectedGrievance(null)}
                    className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    STATUS_CONFIG[selectedGrievance.status]?.color || STATUS_CONFIG.submitted.color
                  }`}>
                    {STATUS_CONFIG[selectedGrievance.status]?.label || 'New'}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedGrievance.title}</h3>
                  <p className={`whitespace-pre-wrap ${theme === 'dark' ? 'text-gray-300' : 'text-slate-600'}`}>{selectedGrievance.description}</p>
                </div>

                {/* Type & Date */}
                <div className="flex items-center gap-4 text-sm">
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}>Type: <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{selectedGrievance.type?.replace('_', ' ')}</span></span>
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}>
                    {toDate(selectedGrievance.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Submitter Info */}
                {submitterInfo && (
                  <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-slate-100'}`}>
                    <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Submitted By</p>
                    <div className="flex items-center gap-2">
                      <User className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                      <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{submitterInfo.name}</span>
                      <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>({submitterInfo.role})</span>
                    </div>
                  </div>
                )}

                {/* Team Info */}
                {teamInfo && (
                  <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-slate-100'}`}>
                    <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Related Team</p>
                    <div className="flex items-center gap-2">
                      <Users className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                      <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{teamInfo.name}</span>
                    </div>
                  </div>
                )}

                {/* Resolution (if resolved) */}
                {selectedGrievance.status === 'resolved' && selectedGrievance.resolution && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-xs text-green-400 mb-1">Resolution</p>
                    <p className="text-white text-sm">{selectedGrievance.resolution}</p>
                  </div>
                )}

                {/* Actions */}
                {selectedGrievance.status !== 'resolved' && selectedGrievance.status !== 'dismissed' && (
                  <div className={`space-y-3 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
                    {selectedGrievance.status === 'submitted' && (
                      <button
                        onClick={() => handleStatusChange(selectedGrievance.id!, 'under_review')}
                        disabled={actionLoading}
                        className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                        Mark Under Review
                      </button>
                    )}

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
                        Resolution Notes *
                      </label>
                      <textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Describe how this grievance was resolved..."
                        rows={3}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm ${
                          theme === 'dark' 
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                            : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                        }`}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleResolve}
                        disabled={actionLoading || !resolution.trim()}
                        className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Resolve
                      </button>
                      <button
                        onClick={() => handleStatusChange(selectedGrievance.id!, 'dismissed')}
                        disabled={actionLoading}
                        className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommissionerGrievances;
