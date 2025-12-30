/**
 * Commissioner Registrations Page
 * World-class registration management dashboard
 * 
 * Features:
 * - View all registrations with status filtering
 * - Open/close registrations
 * - View and manage registrants
 * - Export data to CSV
 * - Real-time participant counts
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  Users, 
  Plus,
  ChevronRight,
  Loader2,
  Search,
  X,
  Check,
  ChevronDown,
  Play,
  Square,
  Download,
  Calendar,
  DollarSign,
  Filter,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Settings,
  UserPlus,
  Target,
  FileText,
  MessageSquare,
  CreditCard,
  Shield,
  Phone,
  Mail,
  User,
  Heart
} from 'lucide-react';
import { Button, Badge, GlassCard, GlassPanel } from '../ui/OSYSComponents';
import EmptyState from '../ui/EmptyState';
import { 
  subscribeToRegistrations,
  subscribeToRegistrants,
  openRegistration,
  closeRegistration,
  completeRegistration,
  cancelRegistration,
  deleteRegistration,
  getRegistrationStats,
  exportRegistrantsToCSV,
  getRegistrationStatusInfo,
  getRegistrationTypeLabel,
  getRegistrationOutcomeLabel,
  updateRegistrantPayment
} from '../../services/registrationService';
import type { ProgramRegistration, Registrant } from '../../types';
import { toastSuccess, toastError, toastInfo } from '../../services/toast';
import { CommissionerRegistrationSetup } from './CommissionerRegistrationSetup';

export const CommissionerRegistrations: React.FC = () => {
  const { user, userData, programData } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  
  // State
  const [registrations, setRegistrations] = useState<ProgramRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected registration for detail view
  const [selectedRegistration, setSelectedRegistration] = useState<ProgramRegistration | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loadingRegistrants, setLoadingRegistrants] = useState(false);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<ProgramRegistration | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [selectedRegistrant, setSelectedRegistrant] = useState<Registrant | null>(null);
  
  // Action states
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  
  // ============================================
  // DATA LOADING
  // ============================================
  
  useEffect(() => {
    if (!programData?.id) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = subscribeToRegistrations(programData.id, (regs) => {
      setRegistrations(regs);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [programData?.id]);
  
  // Load registrants when a registration is selected
  useEffect(() => {
    if (!selectedRegistration || !programData?.id) {
      setRegistrants([]);
      return;
    }
    
    setLoadingRegistrants(true);
    const unsubscribe = subscribeToRegistrants(
      programData.id,
      selectedRegistration.id,
      (regs) => {
        setRegistrants(regs);
        setLoadingRegistrants(false);
      }
    );
    
    return () => unsubscribe();
  }, [selectedRegistration?.id, programData?.id]);
  
  // ============================================
  // FILTERING
  // ============================================
  
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(reg => {
      // Status filter
      if (statusFilter !== 'all' && reg.status !== statusFilter) return false;
      
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!reg.name.toLowerCase().includes(query)) return false;
      }
      
      return true;
    });
  }, [registrations, statusFilter, searchQuery]);
  
  // ============================================
  // ACTIONS
  // ============================================
  
  const handleStatusChange = async (reg: ProgramRegistration, newStatus: 'open' | 'closed' | 'completed' | 'cancelled') => {
    if (!programData?.id) return;
    
    setUpdatingStatus(reg.id);
    try {
      switch (newStatus) {
        case 'open':
          await openRegistration(programData.id, reg.id);
          break;
        case 'closed':
          await closeRegistration(programData.id, reg.id);
          break;
        case 'completed':
          await completeRegistration(programData.id, reg.id);
          break;
        case 'cancelled':
          await cancelRegistration(programData.id, reg.id);
          break;
      }
      setShowActionMenu(null);
    } catch (error) {
      // Toast already shown in service
    } finally {
      setUpdatingStatus(null);
    }
  };
  
  const handleDelete = async (reg: ProgramRegistration) => {
    if (!programData?.id) return;
    
    setDeleting(true);
    try {
      await deleteRegistration(programData.id, reg.id);
      setShowDeleteConfirm(null);
      if (selectedRegistration?.id === reg.id) {
        setSelectedRegistration(null);
      }
    } catch (error) {
      // Toast already shown in service
    } finally {
      setDeleting(false);
    }
  };
  
  const handleExport = async (reg: ProgramRegistration) => {
    if (!programData?.id) return;
    
    setExporting(true);
    try {
      const csv = await exportRegistrantsToCSV(programData.id, reg.id);
      
      // Download CSV
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reg.name.replace(/[^a-z0-9]/gi, '_')}_registrants.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toastSuccess('Export downloaded!');
    } catch (error) {
      toastError('Failed to export');
    } finally {
      setExporting(false);
    }
  };
  
  const copyRegistrationLink = (reg: ProgramRegistration) => {
    // Use hash for HashRouter compatibility
    const link = `${window.location.origin}/#/register/${programData?.id}/${reg.id}`;
    navigator.clipboard.writeText(link);
    toastSuccess('Registration link copied!');
  };
  
  // ============================================
  // RENDER HELPERS
  // ============================================
  
  const renderStatusBadge = (status: ProgramRegistration['status']) => {
    const info = getRegistrationStatusInfo(status);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        status === 'open' ? 'bg-green-500/20 text-green-400' :
        status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
        status === 'closed' ? 'bg-amber-500/20 text-amber-400' :
        status === 'completed' ? 'bg-purple-500/20 text-purple-400' :
        status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
        'bg-slate-500/20 text-slate-400'
      }`}>
        {status === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
        {info.label}
      </span>
    );
  };
  
  // ============================================
  // RENDER
  // ============================================
  
  if (!programData) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-zinc-900' : 'bg-slate-50'} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`${isDark ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200'} border-b backdrop-blur-xl sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-purple-500/20' : 'bg-purple-100'
                }`}>
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Registrations
                  </h1>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {programData.name}
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Registration
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-4 mt-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search registrations..."
                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                  isDark 
                    ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                } focus:ring-2 focus:ring-purple-500/50`}
              />
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              {['all', 'open', 'scheduled', 'closed', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-purple-500 text-white'
                      : isDark
                        ? 'bg-white/5 text-slate-400 hover:bg-white/10'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Registration List */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <EmptyState
                type="generic"
                icon={Users}
                title={registrations.length === 0 ? "No registrations yet" : "No matching registrations"}
                description={registrations.length === 0 
                  ? "Create your first registration to start accepting signups"
                  : "Try adjusting your filters"
                }
                actionLabel={registrations.length === 0 ? "Create Registration" : undefined}
                onAction={registrations.length === 0 ? () => setShowCreateModal(true) : undefined}
              />
            ) : (
              filteredRegistrations.map(reg => (
                <div
                  key={reg.id}
                  onClick={() => setSelectedRegistration(reg)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedRegistration?.id === reg.id
                      ? isDark
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-purple-50 border-purple-200'
                      : isDark
                        ? 'bg-white/5 border-white/10 hover:bg-white/10'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {reg.name}
                        </h3>
                        {renderStatusBadge(reg.status)}
                      </div>
                      
                      <div className={`flex flex-wrap items-center gap-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        <span className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {getRegistrationTypeLabel(reg.type)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(reg.registrationCloseDate).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${reg.registrationFee}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {reg.registrationCount || 0} registered
                        </span>
                      </div>
                    </div>
                    
                    {/* Action Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowActionMenu(showActionMenu === reg.id ? null : reg.id);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                        }`}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {showActionMenu === reg.id && (
                        <div 
                          className={`absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl border z-50 ${
                            isDark ? 'bg-zinc-800 border-white/10' : 'bg-white border-slate-200'
                          }`}
                        >
                          {reg.status === 'draft' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reg, 'open');
                              }}
                              disabled={updatingStatus === reg.id}
                              className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                                isDark ? 'hover:bg-white/10 text-green-400' : 'hover:bg-slate-50 text-green-600'
                              }`}
                            >
                              <Play className="w-4 h-4" />
                              Open Registration
                            </button>
                          )}
                          
                          {reg.status === 'scheduled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reg, 'open');
                              }}
                              disabled={updatingStatus === reg.id}
                              className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                                isDark ? 'hover:bg-white/10 text-green-400' : 'hover:bg-slate-50 text-green-600'
                              }`}
                            >
                              <Play className="w-4 h-4" />
                              Open Now
                            </button>
                          )}
                          
                          {reg.status === 'open' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reg, 'closed');
                              }}
                              disabled={updatingStatus === reg.id}
                              className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                                isDark ? 'hover:bg-white/10 text-amber-400' : 'hover:bg-slate-50 text-amber-600'
                              }`}
                            >
                              <Square className="w-4 h-4" />
                              Close Registration
                            </button>
                          )}
                          
                          {(reg.status === 'closed' || reg.status === 'open') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reg, 'completed');
                              }}
                              disabled={updatingStatus === reg.id}
                              className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                                isDark ? 'hover:bg-white/10 text-purple-400' : 'hover:bg-slate-50 text-purple-600'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Mark Completed
                            </button>
                          )}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyRegistrationLink(reg);
                              setShowActionMenu(null);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                              isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExport(reg);
                              setShowActionMenu(null);
                            }}
                            disabled={exporting}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${
                              isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <Download className="w-4 h-4" />
                            Export CSV
                          </button>
                          
                          <div className={`border-t ${isDark ? 'border-white/10' : 'border-slate-200'}`} />
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(reg);
                              setShowActionMenu(null);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 ${
                              isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedRegistration ? (
              <div className={`rounded-xl border sticky top-24 ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
              }`}>
                {/* Detail Header */}
                <div className={`p-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedRegistration.name}
                    </h3>
                    <button
                      onClick={() => setSelectedRegistration(null)}
                      className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {renderStatusBadge(selectedRegistration.status)}
                </div>
                
                {/* Stats */}
                <div className={`p-4 grid grid-cols-2 gap-4 border-b ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Registered</p>
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedRegistration.registrationCount || 0}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Paid</p>
                    <p className={`text-2xl font-bold text-green-500`}>
                      {selectedRegistration.paidCount || 0}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Fee</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ${selectedRegistration.registrationFee}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Revenue</p>
                    <p className={`text-lg font-semibold text-purple-500`}>
                      ${(selectedRegistration.paidCount || 0) * selectedRegistration.registrationFee}
                    </p>
                  </div>
                </div>
                
                {/* Registrants List */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Registrants ({registrants.length})
                    </h4>
                    {/* Payment Legend */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Paid/Free</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>In Person</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Unpaid</span>
                      </span>
                    </div>
                  </div>
                  
                  {loadingRegistrants ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    </div>
                  ) : registrants.length === 0 ? (
                    <p className={`text-sm text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      No registrants yet
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {registrants.map(reg => (
                        <div 
                          key={reg.id}
                          onClick={() => setSelectedRegistrant(reg)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {reg.fullName}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {reg.ageGroupLabel || reg.calculatedAgeGroup || 'No age group'}
                              </p>
                              {/* Show notes if present */}
                              {(reg.preferences?.notes || reg.parentNotes) && (
                                <div className={`mt-1 flex items-start gap-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                  <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <p className="text-xs truncate">
                                    {reg.preferences?.notes || reg.parentNotes}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Payment Status Pill */}
                              {(() => {
                                const isFree = (selectedRegistration?.registrationFee || 0) === 0;
                                const isPaid = reg.paymentStatus === 'paid' || reg.paymentStatus === 'waived' || isFree;
                                const isPartial = reg.paymentStatus === 'partial' || reg.paymentMethod === 'cash';
                                const isOverdue = reg.paymentStatus === 'pending' && !isFree && reg.paymentMethod !== 'cash';
                                
                                if (isPaid) {
                                  return (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-500">
                                      {isFree ? 'Free' : 'Paid'}
                                    </span>
                                  );
                                } else if (isPartial) {
                                  return (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/20 text-amber-500">
                                      {reg.paymentMethod === 'cash' ? 'In Person' : 'Partial'}
                                    </span>
                                  );
                                } else if (isOverdue) {
                                  return (
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/20 text-red-500">
                                      Unpaid
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/20 text-slate-400">
                                    Pending
                                  </span>
                                );
                              })()}
                              <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`rounded-xl border p-8 text-center ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
              }`}>
                <Users className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                <p className={`${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Select a registration to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Create Modal */}
      {showCreateModal && programData && (
        <div className="fixed inset-0 z-[80]">
          <CommissionerRegistrationSetup
            programId={programData.id}
            program={programData}
            onComplete={(registrationId) => {
              setShowCreateModal(false);
              toastSuccess('Registration created!');
            }}
            onCancel={() => setShowCreateModal(false)}
          />
        </div>
      )}
      
      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Delete Registration?
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {showDeleteConfirm.name}
                </p>
              </div>
            </div>
            
            {(showDeleteConfirm.registrationCount || 0) > 0 && (
              <div className={`p-3 rounded-lg mb-4 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  ⚠️ This registration has {showDeleteConfirm.registrationCount} registrants. 
                  You cannot delete it until all registrants are removed.
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting || (showDeleteConfirm.registrationCount || 0) > 0}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Click outside to close action menu */}
      {showActionMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowActionMenu(null)}
        />
      )}
      
      {/* Registrant Detail Modal */}
      {selectedRegistrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isDark ? 'bg-zinc-900' : 'bg-white'}`}>
            {/* Header */}
            <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                  {selectedRegistrant.firstName?.charAt(0) || '?'}{selectedRegistrant.lastName?.charAt(0) || ''}
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {selectedRegistrant.fullName || `${selectedRegistrant.firstName} ${selectedRegistrant.lastName}`}
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {selectedRegistrant.ageGroupLabel || selectedRegistrant.calculatedAgeGroup || 'No age group'} • Age {selectedRegistrant.calculatedAge}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRegistrant(null)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Payment Section */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Payment</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedRegistrant.paymentStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-green-500">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-medium">Paid in Full</span>
                        </span>
                      ) : selectedRegistrant.paymentStatus === 'partial' ? (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-medium">Partial Payment</span>
                        </span>
                      ) : selectedRegistrant.paymentStatus === 'waived' ? (
                        <span className="inline-flex items-center gap-1 text-blue-500">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="font-medium">Waived</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">Pending</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Method</p>
                    <p className={`font-medium mt-1 capitalize ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedRegistrant.paymentMethod === 'cash' ? 'Pay in Person' : 
                       selectedRegistrant.paymentMethod || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Amount Paid</p>
                    <p className={`font-medium mt-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      ${((selectedRegistrant.amountPaid || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Remaining Balance</p>
                    <p className={`font-medium mt-1 ${(selectedRegistrant.remainingBalance || 0) > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                      ${((selectedRegistrant.remainingBalance || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
                
                {/* Promo Code Section - Show if promo was used */}
                {selectedRegistrant.promoCodeUsed && (
                  <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎟️</span>
                      <span className={`text-sm font-medium ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>Promo Code Applied</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Code Used</p>
                        <p className={`font-mono font-bold mt-0.5 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                          {selectedRegistrant.promoCodeUsed}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Discount Given</p>
                        <p className={`font-medium mt-0.5 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          -${((selectedRegistrant.discountAmount || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                      {selectedRegistrant.originalPrice && (
                        <>
                          <div>
                            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Original Price</p>
                            <p className={`font-medium mt-0.5 line-through ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              ${((selectedRegistrant.originalPrice || 0) / 100).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Final Price</p>
                            <p className={`font-medium mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              ${((selectedRegistrant.finalPrice || selectedRegistrant.amountDue || 0) / 100).toFixed(2)}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedRegistrant.paymentNotes && (
                  <div className={`mt-3 p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <span className="font-medium">Payment Notes:</span> {selectedRegistrant.paymentNotes}
                    </p>
                  </div>
                )}
                
                {/* Payment Actions - Show if not already paid */}
                {selectedRegistrant.paymentStatus !== 'paid' && selectedRegistrant.paymentStatus !== 'waived' && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!programData?.id || !selectedRegistration?.id) return;
                        setMarkingPaid(true);
                        try {
                          await updateRegistrantPayment(
                            programData.id,
                            selectedRegistration.id,
                            selectedRegistrant.id,
                            'mark_paid',
                            { amount: selectedRegistrant.amountDue, method: 'cash' }
                          );
                          // Update local state
                          setSelectedRegistrant({ ...selectedRegistrant, paymentStatus: 'paid' });
                        } finally {
                          setMarkingPaid(false);
                        }
                      }}
                      disabled={markingPaid}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                        isDark 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      } disabled:opacity-50`}
                    >
                      {markingPaid ? 'Processing...' : '✓ Mark as Paid'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!programData?.id || !selectedRegistration?.id) return;
                        setMarkingPaid(true);
                        try {
                          await updateRegistrantPayment(
                            programData.id,
                            selectedRegistration.id,
                            selectedRegistrant.id,
                            'waive',
                            { notes: 'Waived by commissioner' }
                          );
                          // Update local state
                          setSelectedRegistrant({ ...selectedRegistrant, paymentStatus: 'waived' });
                        } finally {
                          setMarkingPaid(false);
                        }
                      }}
                      disabled={markingPaid}
                      className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                        isDark 
                          ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400' 
                          : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
                      } disabled:opacity-50`}
                    >
                      Waive Fee
                    </button>
                  </div>
                )}
                
                {/* Waived explanation */}
                {selectedRegistrant.paymentStatus === 'waived' && (
                  <p className={`mt-2 text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    💡 Waived = Fee was waived by commissioner (scholarship, special circumstance, etc.)
                  </p>
                )}
              </div>
              
              {/* Waiver/Consent Section */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Waivers & Consent</h3>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedRegistrant.waiverSigned ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {selectedRegistrant.waiverSigned ? 'Waiver Signed' : 'Waiver Not Signed'}
                      </p>
                      {selectedRegistrant.waiverSignedAt && (
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                          Signed {new Date((selectedRegistrant.waiverSignedAt as any)?.toDate?.() || selectedRegistrant.waiverSignedAt).toLocaleDateString()}
                          {selectedRegistrant.waiverSignedBy && ` by ${selectedRegistrant.waiverSignedBy}`}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedRegistrant.waiverSigned && (
                    <button className={`text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}>
                      View Form
                    </button>
                  )}
                </div>
              </div>
              
              {/* Contact Info */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <User className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Contact Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Parent/Guardian</p>
                    <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedRegistrant.parentName || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Email</p>
                    <a href={`mailto:${selectedRegistrant.parentEmail || selectedRegistrant.email}`} className="flex items-center gap-1 font-medium mt-1 text-purple-500 hover:underline">
                      <Mail className="w-3 h-3" />
                      {selectedRegistrant.parentEmail || selectedRegistrant.email || 'N/A'}
                    </a>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Phone</p>
                    <a href={`tel:${selectedRegistrant.parentPhone || selectedRegistrant.phone}`} className="flex items-center gap-1 font-medium mt-1 text-purple-500 hover:underline">
                      <Phone className="w-3 h-3" />
                      {selectedRegistrant.parentPhone || selectedRegistrant.phone || 'N/A'}
                    </a>
                  </div>
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Emergency Contact</p>
                    <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedRegistrant.emergencyContact?.name || 'Not specified'}
                      {selectedRegistrant.emergencyContact?.phone && (
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}> • {selectedRegistrant.emergencyContact.phone}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Medical Info */}
              {selectedRegistrant.medicalInfo && (Object.values(selectedRegistrant.medicalInfo).some(v => v)) && (
                <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Medical Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedRegistrant.medicalInfo.allergies && (
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Allergies</p>
                        <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedRegistrant.medicalInfo.allergies}
                        </p>
                      </div>
                    )}
                    {selectedRegistrant.medicalInfo.medications && (
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Medications</p>
                        <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedRegistrant.medicalInfo.medications}
                        </p>
                      </div>
                    )}
                    {selectedRegistrant.medicalInfo.conditions && (
                      <div className="col-span-2">
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Medical Conditions</p>
                        <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedRegistrant.medicalInfo.conditions}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Preferences & Notes */}
              {selectedRegistrant.preferences && (
                <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Preferences & Notes</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedRegistrant.preferences.jerseyNumber && (
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Jersey # Request</p>
                        <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          #{selectedRegistrant.preferences.jerseyNumber}
                        </p>
                      </div>
                    )}
                    {selectedRegistrant.preferences.coachRequest && (
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Coach Request</p>
                        <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedRegistrant.preferences.coachRequest}
                        </p>
                      </div>
                    )}
                    {selectedRegistrant.preferences.friendRequest && (
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Friend Request</p>
                        <p className={`font-medium mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {selectedRegistrant.preferences.friendRequest}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedRegistrant.preferences.notes && (
                    <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Additional Notes from Parent:</p>
                      <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                        {selectedRegistrant.preferences.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Parent Notes (alternate location) */}
              {selectedRegistrant.parentNotes && !selectedRegistrant.preferences?.notes && (
                <div className={`p-4 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                    <h3 className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Notes from Parent</h3>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                    {selectedRegistrant.parentNotes}
                  </p>
                </div>
              )}
              
              {/* Registration Meta */}
              <div className={`p-4 rounded-xl border ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                    Registered {new Date((selectedRegistrant.registeredAt as any)?.toDate?.() || selectedRegistrant.registeredAt).toLocaleDateString()}
                  </span>
                  <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                    ID: {selectedRegistrant.id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommissionerRegistrations;
