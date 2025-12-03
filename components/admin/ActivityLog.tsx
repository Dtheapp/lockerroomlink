import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, Timestamp, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
  History, 
  Search, 
  Filter, 
  User, 
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Shield,
  Users,
  Settings,
  Trash2,
  Edit,
  Plus,
  Mail,
  Megaphone,
  Database,
  ShieldAlert,
  Download,
  RefreshCw,
  X
} from 'lucide-react';

interface ActivityLogEntry {
  id: string;
  action: string;
  details: string;
  adminId: string;
  adminName: string;
  timestamp: Timestamp;
  category?: string;
  targetId?: string;
  targetType?: string;
}

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique admins and actions for filters
  const uniqueAdmins = [...new Set(logs.map(log => log.adminName))].sort();
  const uniqueActions = [...new Set(logs.map(log => log.action))].sort();

  useEffect(() => {
    const logsQuery = query(
      collection(db, 'adminActivityLog'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLogEntry[];
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading activity logs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.details.toLowerCase().includes(term) ||
        log.adminName.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term)
      );
    }

    // Admin filter
    if (selectedAdmin !== 'all') {
      filtered = filtered.filter(log => log.adminName === selectedAdmin);
    }

    // Action filter
    if (selectedAction !== 'all') {
      filtered = filtered.filter(log => log.action === selectedAction);
    }

    // Date range filter
    if (selectedDateRange !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (selectedDateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter(log => {
        if (!log.timestamp) return false;
        const logDate = new Date(log.timestamp.seconds * 1000);
        return logDate >= startDate;
      });
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, selectedAdmin, selectedAction, selectedDateRange]);

  const formatTimestamp = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString();
  };

  const formatRelativeTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp.seconds * 1000);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('add')) return <Plus className="w-4 h-4" />;
    if (actionLower.includes('update') || actionLower.includes('edit')) return <Edit className="w-4 h-4" />;
    if (actionLower.includes('delete') || actionLower.includes('remove')) return <Trash2 className="w-4 h-4" />;
    if (actionLower.includes('email') || actionLower.includes('send')) return <Mail className="w-4 h-4" />;
    if (actionLower.includes('announce')) return <Megaphone className="w-4 h-4" />;
    if (actionLower.includes('moderate') || actionLower.includes('content')) return <ShieldAlert className="w-4 h-4" />;
    if (actionLower.includes('data') || actionLower.includes('cleanup') || actionLower.includes('export')) return <Database className="w-4 h-4" />;
    if (actionLower.includes('user')) return <Users className="w-4 h-4" />;
    if (actionLower.includes('team')) return <Shield className="w-4 h-4" />;
    if (actionLower.includes('setting')) return <Settings className="w-4 h-4" />;
    return <History className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('add')) return 'text-emerald-500 bg-emerald-500/10';
    if (actionLower.includes('update') || actionLower.includes('edit')) return 'text-blue-500 bg-blue-500/10';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return 'text-red-500 bg-red-500/10';
    if (actionLower.includes('email') || actionLower.includes('send')) return 'text-purple-500 bg-purple-500/10';
    if (actionLower.includes('announce')) return 'text-amber-500 bg-amber-500/10';
    if (actionLower.includes('moderate')) return 'text-orange-500 bg-orange-500/10';
    if (actionLower.includes('export')) return 'text-cyan-500 bg-cyan-500/10';
    return 'text-zinc-500 bg-zinc-500/10';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAdmin('all');
    setSelectedAction('all');
    setSelectedDateRange('all');
  };

  const hasActiveFilters = searchTerm || selectedAdmin !== 'all' || selectedAction !== 'all' || selectedDateRange !== 'all';

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'Admin', 'Action', 'Details'].join(','),
      ...filteredLogs.map(log => [
        formatTimestamp(log.timestamp),
        log.adminName,
        log.action,
        `"${log.details.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const todayLogs = logs.filter(log => {
    if (!log.timestamp) return false;
    const today = new Date();
    const logDate = new Date(log.timestamp.seconds * 1000);
    return logDate.toDateString() === today.toDateString();
  }).length;

  const weekLogs = logs.filter(log => {
    if (!log.timestamp) return false;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logDate = new Date(log.timestamp.seconds * 1000);
    return logDate >= weekAgo;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <History className="w-7 h-7 text-orange-500" />
            Activity Log
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            Track all SuperAdmin actions and changes
          </p>
        </div>
        <button
          onClick={exportLogs}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <History className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{logs.length}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Entries</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Calendar className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{todayLogs}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Today</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{weekLogs}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">This Week</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <User className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{uniqueAdmins.length}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Active Admins</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                {[selectedAdmin !== 'all', selectedAction !== 'all', selectedDateRange !== 'all'].filter(Boolean).length}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Admin</label>
              <select
                value={selectedAdmin}
                onChange={(e) => setSelectedAdmin(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Admins</option>
                {uniqueAdmins.map(admin => (
                  <option key={admin} value={admin}>{admin}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Action Type</label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Time Period</label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>
          Showing {filteredLogs.length} of {logs.length} entries
        </span>
        {filteredLogs.length > 0 && filteredLogs[0]?.timestamp && (
          <span className="flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Latest: {formatRelativeTime(filteredLogs[0].timestamp)}
          </span>
        )}
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <History className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">No Activity Found</h3>
            <p className="text-zinc-500 dark:text-zinc-400">
              {hasActiveFilters 
                ? 'Try adjusting your filters to see more results.'
                : 'Activity will appear here as SuperAdmins make changes.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Action Icon */}
                  <div className={`p-2 rounded-lg flex-shrink-0 ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {log.adminName}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {log.details}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {formatRelativeTime(log.timestamp)}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : ''}
                    </p>
                  </div>

                  {/* Expand Icon */}
                  <div className="flex-shrink-0 text-zinc-400">
                    {expandedLog === log.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedLog === log.id && (
                <div className="px-4 pb-4 pt-0">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Admin ID</p>
                        <p className="text-sm text-zinc-900 dark:text-white font-mono">{log.adminId}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Exact Timestamp</p>
                        <p className="text-sm text-zinc-900 dark:text-white">{formatTimestamp(log.timestamp)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Full Details</p>
                      <p className="text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-700">
                        {log.details}
                      </p>
                    </div>
                    {log.targetId && (
                      <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Target ID</p>
                        <p className="text-sm text-zinc-900 dark:text-white font-mono">{log.targetId}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
