import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { Event, PricingTier, Registration, RegistrationStatus } from '../../types/events';
import * as eventService from '../../services/eventService';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Users,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Mail,
  Search,
  Filter,
  MoreVertical,
  UserPlus,
  Banknote,
  CreditCard,
  RefreshCw,
  Trash2,
  Edit2
} from 'lucide-react';

interface RegistrationWithDetails extends Registration {
  pricingTierName?: string;
}

const EventManagement: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!eventId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load event first
        const eventData = await eventService.getEvent(eventId);
        
        if (!eventData) {
          setError('Event not found');
          return;
        }

        setEvent(eventData);
        
        // Try to load pricing tiers and registrations (may fail for simple events)
        try {
          const [tiersData, regsData] = await Promise.all([
            eventService.getPricingTiersByEvent(eventId),
            eventService.getRegistrationsByEvent(eventId)
          ]);
          
          setPricingTiers(tiersData);

          // Enhance registrations with tier names
          const enhancedRegs = regsData.map(reg => ({
            ...reg,
            pricingTierName: tiersData.find(t => t.id === reg.pricingTierId)?.name || 'Unknown'
          }));
          setRegistrations(enhancedRegs);
        } catch (subErr) {
          // It's okay if pricing/registrations fail - might be a simple event
          console.log('Could not load pricing/registrations (may be a simple event):', subErr);
          setPricingTiers([]);
          setRegistrations([]);
        }
      } catch (err) {
        console.error('Error loading event data:', err);
        setError('Failed to load event data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId]);

  // Format helpers
  const formatPrice = (cents: number): string => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (timestamp: Timestamp): string => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  };

  const formatDateTime = (timestamp: Timestamp): string => {
    const date = new Date(timestamp.seconds * 1000);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Filter registrations
  const filteredRegistrations = registrations.filter(reg => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      reg.athleteSnapshot.firstName.toLowerCase().includes(searchLower) ||
      reg.athleteSnapshot.lastName.toLowerCase().includes(searchLower) ||
      reg.emergencyContact?.name?.toLowerCase().includes(searchLower);

    // Status filter
    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;

    // Payment filter
    const matchesPayment = paymentFilter === 'all' ||
      (paymentFilter === 'paid' && reg.paymentStatus === 'completed') ||
      (paymentFilter === 'pending' && reg.paymentStatus === 'pending');

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Actions
  const handleMarkPaid = async (registrationId: string) => {
    setProcessingId(registrationId);
    try {
      await eventService.updateRegistrationPayment(registrationId, 'completed');
      setRegistrations(prev => prev.map(r => 
        r.id === registrationId 
          ? { ...r, paymentStatus: 'completed', status: 'paid' }
          : r
      ));
    } catch (err) {
      console.error('Error marking as paid:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelRegistration = async (registrationId: string) => {
    if (!window.confirm('Are you sure you want to cancel this registration?')) return;
    
    setProcessingId(registrationId);
    try {
      await eventService.cancelRegistration(registrationId);
      setRegistrations(prev => prev.map(r => 
        r.id === registrationId 
          ? { ...r, status: 'cancelled' }
          : r
      ));
      // Update event count
      if (event) {
        setEvent({ ...event, currentCount: event.currentCount - 1 });
      }
    } catch (err) {
      console.error('Error cancelling registration:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddToRoster = async (registrationId: string) => {
    setProcessingId(registrationId);
    try {
      await eventService.updateRegistrationStatus(registrationId, 'roster_added');
      setRegistrations(prev => prev.map(r => 
        r.id === registrationId 
          ? { ...r, status: 'roster_added' }
          : r
      ));
    } catch (err) {
      console.error('Error adding to roster:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Export registrations to CSV
  const handleExportCSV = () => {
    const headers = ['First Name', 'Last Name', 'Tier', 'Amount', 'Payment Status', 'Status', 'Emergency Contact', 'Emergency Phone', 'Registration Date'];
    const rows = filteredRegistrations.map(reg => [
      reg.athleteSnapshot.firstName,
      reg.athleteSnapshot.lastName,
      reg.pricingTierName || '',
      formatPrice(reg.finalPrice),
      reg.paymentStatus,
      reg.status,
      reg.emergencyContact?.name || '',
      reg.emergencyContact?.phone || '',
      formatDate(reg.createdAt)
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.title || 'registrations'}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const stats = {
    total: registrations.length,
    paid: registrations.filter(r => r.paymentStatus === 'completed').length,
    pending: registrations.filter(r => r.paymentStatus === 'pending').length,
    revenue: registrations
      .filter(r => r.paymentStatus === 'completed')
      .reduce((sum, r) => sum + r.finalPrice, 0),
    waitlisted: registrations.filter(r => r.status === 'waitlisted').length
  };

  // Status badge
  const getStatusBadge = (status: RegistrationStatus) => {
    const styles: Record<RegistrationStatus, { bg: string; text: string; icon: React.ReactNode }> = {
      'pending_payment': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: <Clock className="w-3 h-3" /> },
      'paid': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
      'roster_added': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: <UserPlus className="w-3 h-3" /> },
      'waitlisted': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: <Clock className="w-3 h-3" /> },
      'cancelled': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: <XCircle className="w-3 h-3" /> },
      'refunded': { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400', icon: <RefreshCw className="w-3 h-3" /> }
    };
    const style = styles[status] || styles['pending_payment'];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error || 'Event not found'}</p>
          </div>
          <button
            onClick={() => navigate('/events')}
            className="mt-4 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/events')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {event.title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(event.eventStartDate)} • {event.location.name || 'No location'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/events/${eventId}/edit`}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={async () => {
              if (!window.confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
              try {
                await eventService.deleteEvent(eventId!);
                navigate('/events');
              } catch (err) {
                console.error('Error deleting event:', err);
                setError('Failed to delete event');
              }
            }}
            className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.paid}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Paid</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(stats.revenue)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {event.maxCapacity ? `${event.currentCount}/${event.maxCapacity}` : event.currentCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Capacity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RegistrationStatus | 'all')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="paid">Paid</option>
            <option value="roster_added">Added to Roster</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'paid' | 'pending')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
          
          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredRegistrations.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {registrations.length === 0 
                ? 'No registrations yet' 
                : 'No registrations match your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Athlete</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Registered</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRegistrations.map(reg => (
                  <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {reg.athleteSnapshot.firstName} {reg.athleteSnapshot.lastName}
                        </p>
                        {reg.emergencyContact && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Contact: {reg.emergencyContact.name}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {reg.pricingTierName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatPrice(reg.finalPrice)}
                        </p>
                        {reg.discountAmount > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            -{formatPrice(reg.discountAmount)} discount
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {reg.paymentMethod === 'paypal' ? (
                          <CreditCard className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Banknote className="w-4 h-4 text-green-500" />
                        )}
                        <span className={`text-sm ${
                          reg.paymentStatus === 'completed' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {reg.paymentStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(reg.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(reg.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Mark Paid (for in-person payments) */}
                        {reg.paymentStatus === 'pending' && reg.paymentMethod === 'in_person' && (
                          <button
                            onClick={() => handleMarkPaid(reg.id)}
                            disabled={processingId === reg.id}
                            className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
                          >
                            {processingId === reg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Mark Paid'
                            )}
                          </button>
                        )}
                        
                        {/* Add to Roster */}
                        {reg.status === 'paid' && (
                          <button
                            onClick={() => handleAddToRoster(reg.id)}
                            disabled={processingId === reg.id}
                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                          >
                            {processingId === reg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Add to Roster'
                            )}
                          </button>
                        )}
                        
                        {/* Cancel */}
                        {!['cancelled', 'refunded'].includes(reg.status) && (
                          <button
                            onClick={() => handleCancelRegistration(reg.id)}
                            disabled={processingId === reg.id}
                            className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventManagement;
