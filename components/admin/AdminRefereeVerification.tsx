/**
 * OSYS Admin Referee Verification Review
 * For SuperAdmin to review and approve/reject referee verification requests
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPendingVerificationRequests,
  reviewVerificationRequest,
} from '../../services/refereeService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  Shield,
  Check,
  X,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Award,
  AlertCircle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { RefereeVerificationRequest, RefereeProfile } from '../../types/referee';
import type { UserProfile } from '../../types';

export const AdminRefereeVerification: React.FC = () => {
  const { user, userData } = useAuth();
  const [requests, setRequests] = useState<RefereeVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  // Cache for referee profiles and user data
  const [refereeProfiles, setRefereeProfiles] = useState<Record<string, RefereeProfile>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getPendingVerificationRequests();
      setRequests(data);

      // Load referee and user profiles for each request
      const refProfiles: Record<string, RefereeProfile> = {};
      const usrProfiles: Record<string, UserProfile> = {};

      for (const req of data) {
        // Get referee profile
        const refDoc = await getDoc(doc(db, 'refereeProfiles', req.refereeId));
        if (refDoc.exists()) {
          refProfiles[req.refereeId] = refDoc.data() as RefereeProfile;
        }

        // Get user profile
        const usrDoc = await getDoc(doc(db, 'users', req.refereeId));
        if (usrDoc.exists()) {
          usrProfiles[req.refereeId] = usrDoc.data() as UserProfile;
        }
      }

      setRefereeProfiles(refProfiles);
      setUserProfiles(usrProfiles);
    } catch (error) {
      console.error('Error loading verification requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string, refereeId: string) => {
    if (!user || !userData) return;
    setActionLoading(requestId);
    try {
      await reviewVerificationRequest(
        requestId,
        refereeId,
        true,
        user.uid,
        userData.name,
        reviewNotes || undefined
      );
      await loadRequests();
      setReviewNotes('');
      setExpandedId(null);
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string, refereeId: string) => {
    if (!user || !userData) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setActionLoading(requestId);
    try {
      await reviewVerificationRequest(
        requestId,
        refereeId,
        false,
        user.uid,
        userData.name,
        reviewNotes || undefined,
        rejectionReason
      );
      await loadRequests();
      setRejectionReason('');
      setReviewNotes('');
      setExpandedId(null);
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Timestamp | Date | any) => {
    if (!date) return 'Unknown';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Referee Verification</h1>
          <p className="text-slate-400">Review and approve referee verification requests</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg">
          <Clock className="w-4 h-4" />
          <span className="font-medium">{requests.length} Pending</span>
        </div>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Pending Requests</h2>
          <p className="text-slate-400">All verification requests have been processed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const isExpanded = expandedId === request.id;
            const refProfile = refereeProfiles[request.refereeId];
            const usrProfile = userProfiles[request.refereeId];

            return (
              <div
                key={request.id}
                className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
              >
                {/* Request Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : request.id!)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">
                        {request.refereeName || usrProfile?.name || 'Unknown'}
                      </h3>
                      <p className="text-sm text-slate-400">{request.refereeEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Submitted</p>
                      <p className="text-white">{formatDate(request.createdAt)}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-6 space-y-6">
                    {/* Referee Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-white flex items-center gap-2">
                          <User className="w-4 h-4 text-purple-400" />
                          Referee Profile
                        </h4>
                        <div className="bg-white/5 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Experience</span>
                            <span className="text-white">{refProfile?.yearsExperience || 0} years</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Sports</span>
                            <span className="text-white capitalize">
                              {refProfile?.sports?.join(', ') || 'None listed'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Games Reffed</span>
                            <span className="text-white">{refProfile?.totalGamesReffed || 0}</span>
                          </div>
                          {refProfile?.homeLocation && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Location</span>
                              <span className="text-white">
                                {refProfile.homeLocation.city}, {refProfile.homeLocation.state}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Claimed Certifications */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-white flex items-center gap-2">
                          <Award className="w-4 h-4 text-yellow-400" />
                          Claimed Certifications ({request.certificationsClaimed?.length || 0})
                        </h4>
                        <div className="bg-white/5 rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                          {request.certificationsClaimed?.length > 0 ? (
                            request.certificationsClaimed.map((cert, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-white">{cert.name}</span>
                                <span className="text-slate-400 capitalize">{cert.sport}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-500">No certifications claimed</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Submitted Documents */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        Submitted Documents ({request.documents?.length || 0})
                      </h4>
                      {request.documents?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {request.documents.map((doc, i) => (
                            <a
                              key={i}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group"
                            >
                              <FileText className="w-5 h-5 text-slate-400" />
                              <div className="flex-1 min-w-0">
                                <p className="text-white truncate">{doc.name}</p>
                                <p className="text-xs text-slate-500 capitalize">{doc.type.replace('_', ' ')}</p>
                              </div>
                              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-purple-400" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400" />
                          <p className="text-yellow-400">No documents submitted</p>
                        </div>
                      )}
                    </div>

                    {/* Review Notes */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">Review Notes (optional)</label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add notes about this verification review..."
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
                      />
                    </div>

                    {/* Rejection Reason */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-400">Rejection Reason (required if rejecting)</label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why the verification is being rejected..."
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 resize-none"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={() => handleReject(request.id!, request.refereeId)}
                        disabled={actionLoading === request.id}
                        className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(request.id!, request.refereeId)}
                        disabled={actionLoading === request.id}
                        className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {actionLoading === request.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Approve & Verify
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminRefereeVerification;
