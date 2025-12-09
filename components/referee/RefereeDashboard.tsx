/**
 * OSYS Referee Dashboard
 * Main dashboard for referee users
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getRefereeProfile,
  getUpcomingAssignments,
  getPendingAssignments,
  getRefereeStats,
  respondToAssignment,
} from '../../services/refereeService';
import {
  Calendar,
  Clock,
  Check,
  X,
  MapPin,
  DollarSign,
  Award,
  Shield,
  Star,
  TrendingUp,
  FileText,
  Settings,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { RefereeProfile, RefereeAssignment, RefereeStats } from '../../types/referee';
import { InfractionModal } from './InfractionModal';

interface Props {
  onNavigate?: (view: string) => void;
}

export const RefereeDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refereeProfile, setRefereeProfile] = useState<RefereeProfile | null>(null);
  const [upcomingGames, setUpcomingGames] = useState<RefereeAssignment[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RefereeAssignment[]>([]);
  const [stats, setStats] = useState<RefereeStats | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showInfractionModal, setShowInfractionModal] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadDashboardData();
    }
  }, [user?.uid]);

  const loadDashboardData = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const [profileData, upcoming, pending, statsData] = await Promise.all([
        getRefereeProfile(user.uid),
        getUpcomingAssignments(user.uid),
        getPendingAssignments(user.uid),
        getRefereeStats(user.uid),
      ]);
      setRefereeProfile(profileData);
      setUpcomingGames(upcoming);
      setPendingRequests(pending);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToRequest = async (assignmentId: string, accept: boolean) => {
    setActionLoading(assignmentId);
    try {
      await respondToAssignment(assignmentId, accept);
      // Refresh data
      if (user?.uid) {
        const [upcoming, pending] = await Promise.all([
          getUpcomingAssignments(user.uid),
          getPendingAssignments(user.uid),
        ]);
        setUpcomingGames(upcoming);
        setPendingRequests(pending);
      }
    } catch (error) {
      console.error('Error responding to request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Timestamp | Date | any) => {
    if (!date) return 'TBD';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!refereeProfile) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Referee Profile Not Found</h2>
        <p className="text-slate-400">Please complete your referee signup first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Referee Dashboard</h1>
          <p className="text-slate-400">Welcome back, {userData?.name || 'Referee'}</p>
        </div>
        <div className="flex items-center gap-2">
          {refereeProfile.verificationStatus === 'verified' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Verified
            </div>
          )}
          {refereeProfile.verificationStatus === 'pending' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
              <Clock className="w-4 h-4" />
              Verification Pending
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.gamesThisSeason || 0}</p>
          <p className="text-sm text-slate-400">Games This Season</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats?.totalGamesAllTime || 0}</p>
          <p className="text-sm text-slate-400">Total Games</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {refereeProfile.averageRating?.toFixed(1) || 'N/A'}
          </p>
          <p className="text-sm text-slate-400">Rating</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            ${stats?.totalEarnings?.toFixed(0) || 0}
          </p>
          <p className="text-sm text-slate-400">Total Earnings</p>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-6 border border-orange-500/30">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">
              Pending Requests ({pendingRequests.length})
            </h2>
          </div>
          <div className="space-y-3">
            {pendingRequests.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-slate-800/80 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-white">
                    {assignment.homeTeamName} vs {assignment.awayTeamName}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(assignment.gameDate)}
                    </span>
                    {assignment.gameTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(assignment.gameTime)}
                      </span>
                    )}
                    {assignment.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {assignment.location}
                      </span>
                    )}
                  </div>
                  {assignment.paymentAmount && (
                    <p className="text-green-400 text-sm mt-1">
                      ${assignment.paymentAmount} offered
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRespondToRequest(assignment.id!, false)}
                    disabled={actionLoading === assignment.id}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    title="Decline"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleRespondToRequest(assignment.id!, true)}
                    disabled={actionLoading === assignment.id}
                    className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors disabled:opacity-50"
                    title="Accept"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Games */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Upcoming Games</h2>
          <button
            onClick={() => onNavigate?.('schedule')}
            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {upcomingGames.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No upcoming games scheduled</p>
            <p className="text-sm text-slate-500 mt-1">
              Accept assignment requests to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingGames.slice(0, 5).map((game) => (
              <button
                key={game.id}
                onClick={() => onNavigate?.(`game/${game.id}`)}
                className="w-full bg-slate-700/50 hover:bg-slate-700 rounded-lg p-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      {game.homeTeamName} vs {game.awayTeamName}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(game.gameDate)}
                      </span>
                      {game.gameTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(game.gameTime)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs capitalize ${
                      game.role === 'head' ? 'bg-blue-500/20 text-blue-400' :
                      game.role === 'assistant' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-slate-600 text-slate-300'
                    }`}>
                      {game.role || 'Official'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setShowInfractionModal(true)}
          className="bg-gradient-to-br from-red-500/10 to-orange-500/10 hover:from-red-500/20 hover:to-orange-500/20 rounded-xl p-4 border border-red-500/30 text-left transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-medium text-white">Report Infraction</p>
              <p className="text-sm text-slate-400">Document violations</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.('schedule')}
          className="bg-slate-800/50 hover:bg-slate-800 rounded-xl p-4 border border-slate-700 text-left transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Full Schedule</p>
              <p className="text-sm text-slate-400">View all assignments</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => onNavigate?.('profile')}
          className="bg-slate-800/50 hover:bg-slate-800 rounded-xl p-4 border border-slate-700 text-left transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <Settings className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-medium text-white">Edit Profile</p>
              <p className="text-sm text-slate-400">Update availability</p>
            </div>
          </div>
        </button>

        {refereeProfile.verificationStatus === 'unverified' && (
          <button
            onClick={() => onNavigate?.('verification')}
            className="bg-slate-800/50 hover:bg-slate-800 rounded-xl p-4 border border-slate-700 text-left transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center group-hover:bg-yellow-500/30 transition-colors">
                <Award className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-medium text-white">Get Verified</p>
                <p className="text-sm text-slate-400">Earn your badge</p>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Sports Breakdown */}
      {stats && Object.keys(stats.sportBreakdown).length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Games by Sport</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.sportBreakdown).map(([sport, count]) => (
              <div key={sport} className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-sm text-slate-400 capitalize">{sport}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Infraction Modal */}
      <InfractionModal
        isOpen={showInfractionModal}
        onClose={() => setShowInfractionModal(false)}
        onSuccess={() => {
          // Optionally show a success toast or notification
          console.log('Infraction reported successfully');
        }}
      />
    </div>
  );
};

export default RefereeDashboard;
