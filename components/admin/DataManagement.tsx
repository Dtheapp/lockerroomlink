import React, { useState, useEffect } from 'react';
import { 
    collection, getDocs, deleteDoc, doc, writeBatch, 
    query, where, orderBy, limit, Timestamp, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Team, UserProfile } from '../../types';
import { 
    Database, Trash2, AlertTriangle, HardDrive, Users, Shield,
    MessageCircle, FileText, Clock, CheckCircle, XCircle, RefreshCw,
    Download, Archive, Zap, BarChart3, AlertCircle, Loader2
} from 'lucide-react';

interface StorageStats {
    teams: number;
    users: number;
    messages: number;
    posts: number;
    players: number;
    announcements: number;
    activityLogs: number;
}

interface CleanupResult {
    success: boolean;
    message: string;
    count: number;
}

const DataManagement: React.FC = () => {
    const { userData } = useAuth();
    const [stats, setStats] = useState<StorageStats>({
        teams: 0, users: 0, messages: 0, posts: 0, players: 0, announcements: 0, activityLogs: 0
    });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [results, setResults] = useState<CleanupResult[]>([]);
    
    // Confirmation modals
    const [confirmAction, setConfirmAction] = useState<string | null>(null);
    const [confirmInput, setConfirmInput] = useState('');

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // Count documents in each collection
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const announcementsSnapshot = await getDocs(collection(db, 'announcements'));
            const activityLogsSnapshot = await getDocs(collection(db, 'adminActivityLog'));

            let totalMessages = 0;
            let totalPosts = 0;
            let totalPlayers = 0;

            // Count subcollections for each team
            for (const teamDoc of teamsSnapshot.docs) {
                const teamId = teamDoc.id;
                const messagesSnapshot = await getDocs(collection(db, 'teams', teamId, 'messages'));
                const postsSnapshot = await getDocs(collection(db, 'teams', teamId, 'bulletin'));
                const playersSnapshot = await getDocs(collection(db, 'teams', teamId, 'players'));
                
                totalMessages += messagesSnapshot.size;
                totalPosts += postsSnapshot.size;
                totalPlayers += playersSnapshot.size;
            }

            setStats({
                teams: teamsSnapshot.size,
                users: usersSnapshot.size,
                messages: totalMessages,
                posts: totalPosts,
                players: totalPlayers,
                announcements: announcementsSnapshot.size,
                activityLogs: activityLogsSnapshot.size
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const logActivity = async (action: string, details: string) => {
        await addDoc(collection(db, 'adminActivityLog'), {
            action,
            targetType: 'system',
            targetId: 'data-management',
            details,
            performedBy: userData?.uid || 'unknown',
            performedByName: userData?.name || 'Unknown Admin',
            timestamp: serverTimestamp()
        });
    };

    const addResult = (success: boolean, message: string, count: number = 0) => {
        setResults(prev => [...prev, { success, message, count }]);
    };

    // CLEANUP: Old Activity Logs (older than 30 days)
    const cleanupOldActivityLogs = async () => {
        setActionLoading('activityLogs');
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const oldLogsQuery = query(
                collection(db, 'adminActivityLog'),
                where('timestamp', '<', Timestamp.fromDate(thirtyDaysAgo))
            );
            const snapshot = await getDocs(oldLogsQuery);
            
            if (snapshot.empty) {
                addResult(true, 'No old activity logs to clean up', 0);
            } else {
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                await logActivity('CLEANUP', `Deleted ${snapshot.size} activity logs older than 30 days`);
                addResult(true, `Deleted ${snapshot.size} old activity logs`, snapshot.size);
            }
            
            await fetchStats();
        } catch (error) {
            console.error('Error cleaning up activity logs:', error);
            addResult(false, 'Failed to clean up activity logs', 0);
        } finally {
            setActionLoading(null);
        }
    };

    // CLEANUP: Expired Announcements
    const cleanupExpiredAnnouncements = async () => {
        setActionLoading('announcements');
        try {
            const now = Timestamp.now();
            const expiredQuery = query(
                collection(db, 'announcements'),
                where('expiresAt', '<', now)
            );
            const snapshot = await getDocs(expiredQuery);
            
            if (snapshot.empty) {
                addResult(true, 'No expired announcements to clean up', 0);
            } else {
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                await logActivity('CLEANUP', `Deleted ${snapshot.size} expired announcements`);
                addResult(true, `Deleted ${snapshot.size} expired announcements`, snapshot.size);
            }
            
            await fetchStats();
        } catch (error) {
            console.error('Error cleaning up announcements:', error);
            addResult(false, 'Failed to clean up announcements', 0);
        } finally {
            setActionLoading(null);
        }
    };

    // CLEANUP: Orphaned Users (users with teamId pointing to non-existent team)
    const cleanupOrphanedUsers = async () => {
        setActionLoading('orphanedUsers');
        try {
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const validTeamIds = new Set(teamsSnapshot.docs.map(d => d.id));
            
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const orphanedUsers: string[] = [];
            
            usersSnapshot.docs.forEach(userDoc => {
                const data = userDoc.data() as UserProfile;
                if (data.teamId && !validTeamIds.has(data.teamId)) {
                    orphanedUsers.push(userDoc.id);
                }
            });
            
            if (orphanedUsers.length === 0) {
                addResult(true, 'No orphaned user references found', 0);
            } else {
                const batch = writeBatch(db);
                orphanedUsers.forEach(userId => {
                    batch.update(doc(db, 'users', userId), { teamId: null });
                });
                await batch.commit();
                
                await logActivity('CLEANUP', `Fixed ${orphanedUsers.length} users with invalid team references`);
                addResult(true, `Fixed ${orphanedUsers.length} orphaned user references`, orphanedUsers.length);
            }
            
            await fetchStats();
        } catch (error) {
            console.error('Error cleaning up orphaned users:', error);
            addResult(false, 'Failed to clean up orphaned users', 0);
        } finally {
            setActionLoading(null);
        }
    };

    // CLEANUP: Old Chat Messages (keep last 500 per team)
    const cleanupOldMessages = async () => {
        setActionLoading('messages');
        try {
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            let totalDeleted = 0;
            
            for (const teamDoc of teamsSnapshot.docs) {
                const teamId = teamDoc.id;
                const messagesQuery = query(
                    collection(db, 'teams', teamId, 'messages'),
                    orderBy('timestamp', 'desc')
                );
                const messagesSnapshot = await getDocs(messagesQuery);
                
                // Keep first 500, delete the rest
                const toDelete = messagesSnapshot.docs.slice(500);
                
                if (toDelete.length > 0) {
                    // Batch delete (max 500 per batch)
                    for (let i = 0; i < toDelete.length; i += 500) {
                        const batch = writeBatch(db);
                        const chunk = toDelete.slice(i, i + 500);
                        chunk.forEach(msgDoc => batch.delete(msgDoc.ref));
                        await batch.commit();
                    }
                    totalDeleted += toDelete.length;
                }
            }
            
            if (totalDeleted === 0) {
                addResult(true, 'No excess messages to clean up (all teams under 500 limit)', 0);
            } else {
                await logActivity('CLEANUP', `Deleted ${totalDeleted} old chat messages (keeping 500 per team)`);
                addResult(true, `Deleted ${totalDeleted} old messages`, totalDeleted);
            }
            
            await fetchStats();
        } catch (error) {
            console.error('Error cleaning up messages:', error);
            addResult(false, 'Failed to clean up old messages', 0);
        } finally {
            setActionLoading(null);
        }
    };

    // EXPORT: Full Database Export
    const exportDatabaseSummary = async () => {
        setActionLoading('export');
        try {
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const usersSnapshot = await getDocs(collection(db, 'users'));
            
            const exportData = {
                exportDate: new Date().toISOString(),
                summary: stats,
                teams: teamsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
                users: usersSnapshot.docs.map(d => {
                    const data = d.data();
                    // Exclude sensitive info
                    return {
                        id: d.id,
                        name: data.name,
                        email: data.email,
                        role: data.role,
                        teamId: data.teamId,
                        createdAt: data.createdAt
                    };
                })
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `database-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            await logActivity('EXPORT', 'Exported database summary');
            addResult(true, 'Database summary exported successfully', 0);
        } catch (error) {
            console.error('Error exporting database:', error);
            addResult(false, 'Failed to export database', 0);
        } finally {
            setActionLoading(null);
        }
    };

    // DANGER: Clear All Activity Logs
    const clearAllActivityLogs = async () => {
        if (confirmInput !== 'CLEAR LOGS') return;
        
        setActionLoading('clearLogs');
        try {
            const snapshot = await getDocs(collection(db, 'adminActivityLog'));
            
            for (let i = 0; i < snapshot.docs.length; i += 500) {
                const batch = writeBatch(db);
                const chunk = snapshot.docs.slice(i, i + 500);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            
            addResult(true, `Cleared ${snapshot.size} activity logs`, snapshot.size);
            await fetchStats();
        } catch (error) {
            console.error('Error clearing activity logs:', error);
            addResult(false, 'Failed to clear activity logs', 0);
        } finally {
            setActionLoading(null);
            setConfirmAction(null);
            setConfirmInput('');
        }
    };

    const ActionCard: React.FC<{
        title: string;
        description: string;
        icon: React.ReactNode;
        action: () => void;
        actionLabel: string;
        loadingKey: string;
        color: 'blue' | 'green' | 'orange' | 'red';
        disabled?: boolean;
    }> = ({ title, description, icon, action, actionLabel, loadingKey, color, disabled }) => {
        const colorClasses = {
            blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400',
            green: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400',
            orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50 text-orange-600 dark:text-orange-400',
            red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400'
        };
        
        const buttonClasses = {
            blue: 'bg-blue-600 hover:bg-blue-700',
            green: 'bg-emerald-600 hover:bg-emerald-700',
            orange: 'bg-orange-600 hover:bg-orange-700',
            red: 'bg-red-600 hover:bg-red-700'
        };

        return (
            <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white dark:bg-black/30">
                        {icon}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{description}</p>
                        <button
                            onClick={action}
                            disabled={actionLoading !== null || disabled}
                            className={`mt-3 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${buttonClasses[color]}`}
                        >
                            {actionLoading === loadingKey ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                            ) : (
                                actionLabel
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Database className="w-8 h-8 text-orange-500" />
                        Data Management
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Database utilities, cleanup tools, and maintenance operations
                    </p>
                </div>
                <button 
                    onClick={fetchStats}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-zinc-800"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </button>
            </div>

            {/* Storage Stats */}
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <HardDrive className="w-5 h-5 text-orange-500" /> Database Overview
                </h2>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="w-6 h-6 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <div className="text-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <Shield className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.teams}</p>
                            <p className="text-xs text-slate-500">Teams</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.users}</p>
                            <p className="text-xs text-slate-500">Users</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <Users className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.players}</p>
                            <p className="text-xs text-slate-500">Players</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <MessageCircle className="w-5 h-5 mx-auto text-cyan-500 mb-1" />
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.messages}</p>
                            <p className="text-xs text-slate-500">Messages</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <FileText className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.posts}</p>
                            <p className="text-xs text-slate-500">Posts</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <Zap className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.announcements}</p>
                            <p className="text-xs text-slate-500">Announcements</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 dark:bg-zinc-900 rounded-lg">
                            <BarChart3 className="w-5 h-5 mx-auto text-slate-500 mb-1" />
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.activityLogs}</p>
                            <p className="text-xs text-slate-500">Logs</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Log */}
            {results.length > 0 && (
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 dark:text-white">Operation Results</h3>
                        <button 
                            onClick={() => setResults([])}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {results.map((result, i) => (
                            <div 
                                key={i}
                                className={`flex items-center gap-2 text-sm p-2 rounded ${
                                    result.success 
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                }`}
                            >
                                {result.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                {result.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cleanup Tools */}
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Archive className="w-5 h-5 text-orange-500" /> Cleanup Tools
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <ActionCard
                        title="Clean Old Activity Logs"
                        description="Delete activity logs older than 30 days to free up space"
                        icon={<Clock className="w-5 h-5" />}
                        action={cleanupOldActivityLogs}
                        actionLabel="Clean Up Logs"
                        loadingKey="activityLogs"
                        color="blue"
                    />
                    <ActionCard
                        title="Remove Expired Announcements"
                        description="Delete announcements that have passed their expiration date"
                        icon={<Zap className="w-5 h-5" />}
                        action={cleanupExpiredAnnouncements}
                        actionLabel="Clean Announcements"
                        loadingKey="announcements"
                        color="green"
                    />
                    <ActionCard
                        title="Fix Orphaned Users"
                        description="Reset teamId for users linked to deleted teams"
                        icon={<Users className="w-5 h-5" />}
                        action={cleanupOrphanedUsers}
                        actionLabel="Fix Orphaned Users"
                        loadingKey="orphanedUsers"
                        color="orange"
                    />
                    <ActionCard
                        title="Trim Old Messages"
                        description="Keep only the last 500 messages per team to optimize performance"
                        icon={<MessageCircle className="w-5 h-5" />}
                        action={cleanupOldMessages}
                        actionLabel="Trim Messages"
                        loadingKey="messages"
                        color="orange"
                    />
                </div>
            </div>

            {/* Export Tools */}
            <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Download className="w-5 h-5 text-orange-500" /> Export Tools
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <ActionCard
                        title="Export Database Summary"
                        description="Download a JSON file with all teams and users (sanitized)"
                        icon={<Download className="w-5 h-5" />}
                        action={exportDatabaseSummary}
                        actionLabel="Export JSON"
                        loadingKey="export"
                        color="blue"
                    />
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/50 p-5">
                <h2 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5" /> Danger Zone
                </h2>
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                    These actions are destructive and cannot be undone. Use with extreme caution.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-red-300 dark:border-red-800 p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 dark:text-white">Clear All Activity Logs</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    Permanently delete ALL activity logs from the system
                                </p>
                                <button
                                    onClick={() => setConfirmAction('clearLogs')}
                                    disabled={actionLoading !== null}
                                    className="mt-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    Clear All Logs
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-red-300 dark:border-red-800 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Confirm Dangerous Action</h2>
                        </div>
                        
                        <p className="text-slate-700 dark:text-slate-300 mb-4">
                            This action is <span className="font-bold text-red-600">irreversible</span>. All activity logs will be permanently deleted.
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Type <span className="font-mono bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded">CLEAR LOGS</span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={confirmInput}
                                onChange={(e) => setConfirmInput(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white"
                                placeholder="Type here..."
                            />
                        </div>
                        
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setConfirmAction(null); setConfirmInput(''); }}
                                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={clearAllActivityLogs}
                                disabled={confirmInput !== 'CLEAR LOGS' || actionLoading !== null}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {actionLoading === 'clearLogs' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                                ) : (
                                    <><Trash2 className="w-4 h-4" /> Delete All</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataManagement;
