/**
 * OSYS Referee Payments Dashboard
 * Track and manage referee payments
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRefereePaymentHistory, getRefereeProfile } from '../../services/refereeService';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  ChevronDown,
  Building,
  AlertCircle,
} from 'lucide-react';
import type { RefereePayment, RefereeProfile } from '../../types/referee';

type StatusFilter = 'all' | 'pending' | 'completed' | 'failed';
type TimeFilter = 'all' | 'week' | 'month' | 'quarter' | 'year';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getStatusColor = (status: RefereePayment['status']): string => {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'failed':
    case 'refunded':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

export const RefereePayments: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<RefereePayment[]>([]);
  const [profile, setProfile] = useState<RefereeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadData();
    }
  }, [user?.uid]);

  const loadData = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [paymentsData, profileData] = await Promise.all([
        getRefereePaymentHistory(user.uid),
        getRefereeProfile(user.uid),
      ]);
      setPayments(paymentsData);
      setProfile(profileData);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    // Status filter
    if (statusFilter !== 'all' && payment.status !== statusFilter) return false;

    // Time filter
    if (timeFilter !== 'all' && payment.createdAt) {
      const date = payment.createdAt.toDate ? payment.createdAt.toDate() : new Date(payment.createdAt as any);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      switch (timeFilter) {
        case 'week':
          if (diffDays > 7) return false;
          break;
        case 'month':
          if (diffDays > 30) return false;
          break;
        case 'quarter':
          if (diffDays > 90) return false;
          break;
        case 'year':
          if (diffDays > 365) return false;
          break;
      }
    }

    return true;
  });

  // Calculate stats
  const totalEarned = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAmount = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const thisMonthEarned = payments
    .filter((p) => {
      if (p.status !== 'completed' || !p.paidAt) return false;
      const date = p.paidAt.toDate ? p.paidAt.toDate() : new Date(p.paidAt as any);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const gamesThisMonth = payments.filter((p) => {
    if (!p.createdAt) return false;
    const date = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt as any);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-500 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            Payments
          </h1>
          <p className="text-slate-400 mt-1">Track your officiating earnings</p>
        </div>

        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 flex items-center gap-2 transition-colors">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-sm text-slate-400">Total Earned</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(totalEarned)}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-sm text-slate-400">Pending</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{formatCurrency(pendingAmount)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-sm text-slate-400">This Month</p>
          </div>
          <p className="text-2xl font-bold text-purple-400">{formatCurrency(thisMonthEarned)}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-sm text-slate-400">Games This Month</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">{gamesThisMonth}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {(statusFilter !== 'all' || timeFilter !== 'all') && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setTimeFilter('all');
              }}
              className="text-sm text-purple-400 hover:text-purple-300"
            >
              Clear filters
            </button>
          )}
        </div>

        <p className="text-sm text-slate-400">
          {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {showFilters && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-wrap gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Status</label>
            <div className="flex gap-2">
              {(['all', 'pending', 'completed', 'failed'] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${
                    statusFilter === status
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Time Period</label>
            <div className="flex gap-2">
              {([
                { key: 'all', label: 'All Time' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'quarter', label: 'This Quarter' },
                { key: 'year', label: 'This Year' },
              ] as { key: TimeFilter; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTimeFilter(key)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    timeFilter === key
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments List */}
      {filteredPayments.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
          <DollarSign className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Payments Found</h2>
          <p className="text-slate-400">
            {payments.length === 0
              ? 'Payment records will appear here after you officiate games'
              : 'No payments match your current filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                    <Building className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{payment.paidByName || 'Payment'}</p>
                    <p className="text-sm text-slate-400">
                      {formatDate(payment.createdAt)} • {payment.assignmentIds.length} game{payment.assignmentIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full border capitalize ${getStatusColor(
                      payment.status
                    )}`}
                  >
                    {payment.status === 'completed' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {payment.status === 'pending' && <Clock className="w-3 h-3 inline mr-1" />}
                    {(payment.status === 'failed' || payment.status === 'refunded') && <XCircle className="w-3 h-3 inline mr-1" />}
                    {payment.status}
                  </span>
                  <p className="text-xl font-bold text-white">{formatCurrency(payment.amount)}</p>
                </div>
              </div>

              {/* Payment Details */}
              <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-4 text-sm">
                <span className="text-slate-400">
                  Method: <span className="text-slate-300 capitalize">{payment.method}</span>
                </span>
                {payment.paidAt && (
                  <span className="text-slate-400">
                    Paid: <span className="text-slate-300">{formatDate(payment.paidAt)}</span>
                  </span>
                )}
                {payment.notes && (
                  <span className="text-slate-400">
                    Note: <span className="text-slate-300">{payment.notes}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Info Notice */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-400 font-medium">Payment Information</p>
          <p className="text-sm text-blue-300/70 mt-1">
            Payments are processed by individual leagues. Contact the league directly for payment inquiries.
            This dashboard tracks payment records for your reference.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RefereePayments;
