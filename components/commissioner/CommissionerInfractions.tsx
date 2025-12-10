/**
 * Commissioner Infractions Management Component
 * Allows commissioners to view and manage infractions/tickets
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  Timestamp,
  orderBy 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Infraction } from '../../types';
import { 
  Shield, 
  ChevronRight, 
  AlertTriangle, 
  Loader2, 
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Ticket,
  User,
  Calendar
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
  appealed: { label: 'Appealed', color: 'bg-purple-500/20 text-purple-400', icon: AlertTriangle },
};

const SEVERITY_CONFIG = {
  minor: { label: 'Minor', color: 'bg-blue-500/20 text-blue-400' },
  moderate: { label: 'Moderate', color: 'bg-yellow-500/20 text-yellow-400' },
  major: { label: 'Major', color: 'bg-orange-500/20 text-orange-400' },
  severe: { label: 'Severe', color: 'bg-red-500/20 text-red-400' },
};

export const CommissionerInfractions: React.FC = () => {
  const { userData, user } = useAuth();
  const { theme } = useTheme();
  
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selectedInfraction, setSelectedInfraction] = useState<Infraction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadInfractions = async () => {
      try {
        // Load all infractions (commissioners can see all)
        const infractionsQuery = query(
          collection(db, 'infractions'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(infractionsQuery);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Infraction[];
        setInfractions(data);
      } catch (error) {
        console.error('Error loading infractions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInfractions();
  }, [user]);

  const handleStatusChange = async (infractionId: string, newStatus: string) => {
    if (!user) return;
    setActionLoading(true);
    
    try {
      await updateDoc(doc(db, 'infractions', infractionId), { 
        status: newStatus,
        updatedAt: Timestamp.now(),
        updatedBy: user.uid
      });
      
      setInfractions(prev => prev.map(i => 
        i.id === infractionId ? { ...i, status: newStatus as Infraction['status'] } : i
      ));
      
      if (selectedInfraction?.id === infractionId) {
        setSelectedInfraction(prev => prev ? { ...prev, status: newStatus as Infraction['status'] } : null);
      }
    } catch (error) {
      console.error('Error updating infraction:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedInfraction || !user || !resolution.trim()) return;
    setActionLoading(true);
    
    try {
      await updateDoc(doc(db, 'infractions', selectedInfraction.id!), {
        status: 'resolved',
        resolution,
        resolvedAt: Timestamp.now(),
        resolvedBy: user.uid,
        updatedAt: Timestamp.now()
      });
      
      setInfractions(prev => prev.map(i => 
        i.id === selectedInfraction.id ? { ...i, status: 'resolved', resolution } : i
      ));
      
      setSelectedInfraction(prev => prev ? { ...prev, status: 'resolved', resolution } : null);
      setResolution('');
    } catch (error) {
      console.error('Error resolving infraction:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter infractions
  const filteredInfractions = infractions.filter(i => {
    const matchesSearch = 
      i.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.playerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.teamName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || i.status === filterStatus;
    const matchesSeverity = filterSeverity === 'all' || i.severity === filterSeverity;
    return matchesSearch && matchesStatus && matchesSeverity;
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
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Infraction Management</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Infraction List */}
          <div className="flex-1">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search infractions..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                    theme === 'dark' 
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
              
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  theme === 'dark' 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="all">All Severity</option>
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
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
            {filteredInfractions.length === 0 ? (
              <div className={`rounded-xl p-12 text-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'}`}>
                <Ticket className={`w-16 h-16 mx-auto mb-4 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {infractions.length === 0 ? 'No Infractions' : 'No Results Found'}
                </h2>
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}>
                  {infractions.length === 0 
                    ? 'No infractions have been reported yet.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInfractions.map((infraction) => {
                  const statusConfig = STATUS_CONFIG[infraction.status] || STATUS_CONFIG.submitted;
                  const severityConfig = SEVERITY_CONFIG[infraction.severity] || SEVERITY_CONFIG.minor;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <button
                      key={infraction.id}
                      onClick={() => setSelectedInfraction(infraction)}
                      className={`w-full text-left border rounded-xl p-4 transition-all ${
                        selectedInfraction?.id === infraction.id 
                          ? 'border-purple-500' 
                          : theme === 'dark' 
                            ? 'bg-gray-800 hover:bg-gray-750 border-gray-700 hover:border-gray-600'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                          </div>
                          <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {infraction.playerName || 'Unknown Player'}
                          </h3>
                          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                            {infraction.teamName || 'Unknown Team'}
                          </p>
                          <p className={`text-sm line-clamp-2 mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                            {infraction.description}
                          </p>
                          <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>
                            {toDate(infraction.createdAt).toLocaleDateString()}
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
          {selectedInfraction && (
            <div className={`lg:w-[400px] rounded-xl overflow-hidden sticky top-4 ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-slate-200'
            }`}>
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Infraction Details</h2>
                  <button
                    onClick={() => setSelectedInfraction(null)}
                    className={theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'}
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Status & Severity Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    STATUS_CONFIG[selectedInfraction.status]?.color || STATUS_CONFIG.submitted.color
                  }`}>
                    {STATUS_CONFIG[selectedInfraction.status]?.label || 'New'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    SEVERITY_CONFIG[selectedInfraction.severity]?.color || SEVERITY_CONFIG.minor.color
                  }`}>
                    {SEVERITY_CONFIG[selectedInfraction.severity]?.label || 'Minor'}
                  </span>
                </div>

                {/* Player & Team */}
                <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-slate-100'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <User className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                    <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{selectedInfraction.playerName || 'Unknown'}</span>
                  </div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                    Team: {selectedInfraction.teamName || 'Unknown'}
                  </p>
                </div>

                {/* Description */}
                <div>
                  <h4 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>Description</h4>
                  <p className={`whitespace-pre-wrap ${theme === 'dark' ? 'text-gray-300' : 'text-slate-600'}`}>{selectedInfraction.description}</p>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}>
                    {toDate(selectedInfraction.createdAt).toLocaleDateString()} at {toDate(selectedInfraction.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Resolution (if resolved) */}
                {selectedInfraction.status === 'resolved' && selectedInfraction.resolution && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-xs text-green-400 mb-1">Resolution</p>
                    <p className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{selectedInfraction.resolution}</p>
                  </div>
                )}

                {/* Actions */}
                {selectedInfraction.status !== 'resolved' && selectedInfraction.status !== 'dismissed' && (
                  <div className={`space-y-3 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-slate-200'}`}>
                    {selectedInfraction.status === 'submitted' && (
                      <button
                        onClick={() => handleStatusChange(selectedInfraction.id!, 'under_review')}
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
                        placeholder="Describe how this infraction was resolved..."
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
                        onClick={() => handleStatusChange(selectedInfraction.id!, 'dismissed')}
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

export default CommissionerInfractions;
