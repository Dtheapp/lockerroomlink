/**
 * OSYS Referee Schedule
 * Full schedule view for referees
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRefereeAssignments, respondToAssignment } from '../../services/refereeService';
import {
  Calendar,
  Clock,
  MapPin,
  Check,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { RefereeAssignment } from '../../types/referee';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'completed' | 'declined' | 'cancelled';
type TimeFilter = 'upcoming' | 'past' | 'all';

interface Props {
  onSelectGame?: (assignmentId: string) => void;
}

export const RefereeSchedule: React.FC<Props> = ({ onSelectGame }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<RefereeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('upcoming');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (user?.uid) {
      loadAssignments();
    }
  }, [user?.uid]);

  const loadAssignments = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await getRefereeAssignments(user.uid);
      setAssignments(data);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (assignmentId: string, accept: boolean) => {
    setActionLoading(assignmentId);
    try {
      await respondToAssignment(assignmentId, accept);
      await loadAssignments();
    } catch (error) {
      console.error('Error responding:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Timestamp | Date | any) => {
    if (!date) return 'TBD';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getDateObj = (date: Timestamp | Date | any): Date => {
    if (!date) return new Date();
    return date instanceof Timestamp ? date.toDate() : new Date(date);
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((a) => {
    // Status filter
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;

    // Time filter
    const gameDate = getDateObj(a.gameDate);
    const now = new Date();
    if (timeFilter === 'upcoming' && gameDate < now && a.status !== 'pending') return false;
    if (timeFilter === 'past' && gameDate >= now) return false;

    return true;
  });

  // Group by date
  const groupedByDate = filteredAssignments.reduce((acc, assignment) => {
    const dateKey = formatDate(assignment.gameDate);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(assignment);
    return acc;
  }, {} as Record<string, RefereeAssignment[]>);

  // Sort date keys
  const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return timeFilter === 'past' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
  });

  const getStatusBadge = (status: RefereeAssignment['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
            <AlertCircle className="w-3 h-3" />
            Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
            <Check className="w-3 h-3" />
            Accepted
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'declined':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
            <X className="w-3 h-3" />
            Declined
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Schedule</h1>
        <p className="text-slate-400">{filteredAssignments.length} games</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Schedule List */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Games Found</h2>
          <p className="text-slate-400">
            {statusFilter !== 'all' || timeFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Accept assignment requests to see them here'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDateKeys.map((dateKey) => (
            <div key={dateKey}>
              <h3 className="text-sm font-medium text-slate-400 mb-3">{dateKey}</h3>
              <div className="space-y-3">
                {groupedByDate[dateKey].map((assignment) => (
                  <div
                    key={assignment.id}
                    className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-white text-lg">
                            {assignment.homeTeamName} vs {assignment.awayTeamName}
                          </h4>
                          {getStatusBadge(assignment.status)}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                          {assignment.gameTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(assignment.gameTime)}
                            </span>
                          )}
                          {assignment.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {assignment.location}
                            </span>
                          )}
                          <span className="capitalize px-2 py-0.5 bg-slate-700 rounded text-slate-300">
                            {assignment.sport}
                          </span>
                          {assignment.role && (
                            <span className="capitalize text-blue-400">
                              {assignment.role} Referee
                            </span>
                          )}
                        </div>

                        {assignment.paymentAmount != null && assignment.paymentAmount > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-green-400">
                            <DollarSign className="w-4 h-4" />
                            <span>${assignment.paymentAmount}</span>
                            {assignment.paymentStatus === 'paid' && (
                              <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded-full ml-2">
                                Paid
                              </span>
                            )}
                            {assignment.paymentStatus === 'pending' && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-2">
                                Payment Pending
                              </span>
                            )}
                          </div>
                        )}

                        {assignment.notes && (
                          <p className="text-sm text-slate-500 mt-2 italic">
                            "{assignment.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {assignment.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRespond(assignment.id!, false)}
                              disabled={actionLoading === assignment.id}
                              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                            <button
                              onClick={() => handleRespond(assignment.id!, true)}
                              disabled={actionLoading === assignment.id}
                              className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                              Accept
                            </button>
                          </div>
                        )}

                        {(assignment.status === 'accepted' || assignment.status === 'completed') && (
                          <button
                            onClick={() => onSelectGame?.(assignment.id!)}
                            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-colors"
                          >
                            View Game
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RefereeSchedule;
