import React, { useState, useEffect } from 'react';
import { 
    collection, onSnapshot, addDoc, deleteDoc, doc, getDocs, 
    serverTimestamp, query, orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Team } from '../../types';
import { 
    Megaphone, Send, Trash2, AlertTriangle, Clock, Users, 
    CheckSquare, Square, X, ChevronDown, ChevronUp, Globe,
    Target, History, Plus
} from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    message: string;
    priority: 'normal' | 'important' | 'urgent';
    targetTeams: string[] | 'all';
    createdBy: string;
    createdByName: string;
    createdAt: Timestamp;
    expiresAt?: Timestamp | null;
}

const Announcements: React.FC = () => {
    const { userData } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal & Form States
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    
    // Form Fields
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [targetType, setTargetType] = useState<'all' | 'selected'>('all');
    const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
    const [expiresIn, setExpiresIn] = useState<string>('never'); // 'never', '1day', '3days', '7days', '30days'
    
    // Expanded state for viewing full announcements
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        // Fetch announcements
        const announcementsQuery = query(
            collection(db, 'announcements'), 
            orderBy('createdAt', 'desc')
        );
        
        const unsubAnnouncements = onSnapshot(announcementsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            } as Announcement));
            setAnnouncements(data);
            setLoading(false);
        });

        // Fetch teams for targeting
        const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
            const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
            setTeams(teamsData);
        });

        return () => {
            unsubAnnouncements();
            unsubTeams();
        };
    }, []);

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            setError('Title and message are required.');
            return;
        }
        
        if (targetType === 'selected' && selectedTeams.size === 0) {
            setError('Please select at least one team.');
            return;
        }

        setIsSending(true);
        setError('');

        try {
            const targetTeams = targetType === 'all' ? 'all' : Array.from(selectedTeams);
            
            // Calculate expiration date
            let expiresAt = null;
            if (expiresIn !== 'never') {
                const days = parseInt(expiresIn.replace('days', '').replace('day', ''));
                const expirationDate = new Date();
                expirationDate.setDate(expirationDate.getDate() + days);
                expiresAt = Timestamp.fromDate(expirationDate);
            }

            // Create the announcement document
            const announcementRef = await addDoc(collection(db, 'announcements'), {
                title: title.trim(),
                message: message.trim(),
                priority,
                targetTeams,
                createdBy: userData?.uid || 'unknown',
                createdByName: userData?.name || 'Unknown Admin',
                createdAt: serverTimestamp(),
                expiresAt
            });

            // Post to each target team's bulletin board
            const teamsToNotify = targetType === 'all' ? teams : teams.filter(t => selectedTeams.has(t.id));
            const batch = writeBatch(db);
            
            for (const team of teamsToNotify) {
                const bulletinRef = doc(collection(db, 'teams', team.id, 'bulletin'));
                batch.set(bulletinRef, {
                    text: `📢 ${title}\n\n${message}`,
                    author: `System (${userData?.name || 'Admin'})`,
                    timestamp: serverTimestamp(),
                    isAnnouncement: true,
                    announcementId: announcementRef.id,
                    priority
                });
            }
            
            await batch.commit();

            // Log activity
            await addDoc(collection(db, 'adminActivityLog'), {
                action: 'CREATE',
                targetType: 'announcement',
                targetId: announcementRef.id,
                details: `Created ${priority} announcement "${title}" for ${targetType === 'all' ? 'all teams' : `${selectedTeams.size} teams`}`,
                performedBy: userData?.uid || 'unknown',
                performedByName: userData?.name || 'Unknown Admin',
                timestamp: serverTimestamp()
            });

            // Reset form
            setTitle('');
            setMessage('');
            setPriority('normal');
            setTargetType('all');
            setSelectedTeams(new Set());
            setExpiresIn('never');
            setCreateModalOpen(false);
        } catch (err) {
            console.error('Error creating announcement:', err);
            setError('Failed to create announcement.');
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteAnnouncement = async () => {
        if (!announcementToDelete) return;
        setIsDeleting(true);

        try {
            await deleteDoc(doc(db, 'announcements', announcementToDelete.id));
            
            // Log activity
            await addDoc(collection(db, 'adminActivityLog'), {
                action: 'DELETE',
                targetType: 'announcement',
                targetId: announcementToDelete.id,
                details: `Deleted announcement "${announcementToDelete.title}"`,
                performedBy: userData?.uid || 'unknown',
                performedByName: userData?.name || 'Unknown Admin',
                timestamp: serverTimestamp()
            });

            setDeleteModalOpen(false);
            setAnnouncementToDelete(null);
        } catch (err) {
            console.error('Error deleting announcement:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleTeamSelection = (teamId: string) => {
        const newSelection = new Set(selectedTeams);
        if (newSelection.has(teamId)) {
            newSelection.delete(teamId);
        } else {
            newSelection.add(teamId);
        }
        setSelectedTeams(newSelection);
    };

    const selectAllTeams = () => {
        setSelectedTeams(new Set(teams.map(t => t.id)));
    };

    const deselectAllTeams = () => {
        setSelectedTeams(new Set());
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'urgent': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800';
            case 'important': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800';
            default: return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800';
        }
    };

    const formatDate = (timestamp: Timestamp | undefined) => {
        if (!timestamp) return 'Unknown';
        return timestamp.toDate().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const isExpired = (announcement: Announcement) => {
        if (!announcement.expiresAt) return false;
        return announcement.expiresAt.toDate() < new Date();
    };

    // Filter out expired announcements for active view
    const activeAnnouncements = announcements.filter(a => !isExpired(a));
    const expiredAnnouncements = announcements.filter(a => isExpired(a));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Megaphone className="w-8 h-8 text-orange-500" />
                        Announcements
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Broadcast messages to all teams or select specific ones
                    </p>
                </div>
                <button 
                    onClick={() => setCreateModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                >
                    <Plus className="w-5 h-5" />
                    New Announcement
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <Globe className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Active</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{activeAnnouncements.length}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Urgent</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                        {activeAnnouncements.filter(a => a.priority === 'urgent').length}
                    </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                        <Target className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Teams</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{teams.length}</p>
                </div>
                <div className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                        <History className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Expired</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{expiredAnnouncements.length}</p>
                </div>
            </div>

            {/* Announcements List */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                </div>
            ) : activeAnnouncements.length === 0 ? (
                <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-12 text-center">
                    <Megaphone className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400 text-lg">No active announcements</p>
                    <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">Create one to broadcast to your teams</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Active Announcements
                    </h2>
                    {activeAnnouncements.map(announcement => (
                        <div 
                            key={announcement.id}
                            className={`bg-white dark:bg-zinc-950 rounded-xl border ${
                                announcement.priority === 'urgent' 
                                    ? 'border-red-300 dark:border-red-800' 
                                    : announcement.priority === 'important'
                                    ? 'border-yellow-300 dark:border-yellow-800'
                                    : 'border-slate-200 dark:border-zinc-800'
                            } overflow-hidden shadow-sm`}
                        >
                            <div 
                                className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
                                onClick={() => setExpandedId(expandedId === announcement.id ? null : announcement.id)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getPriorityColor(announcement.priority)}`}>
                                                {announcement.priority}
                                            </span>
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-800">
                                                {announcement.targetTeams === 'all' 
                                                    ? `All Teams (${teams.length})` 
                                                    : `${(announcement.targetTeams as string[]).length} Teams`}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                            {announcement.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                            {announcement.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAnnouncementToDelete(announcement);
                                                setDeleteModalOpen(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        {expandedId === announcement.id ? (
                                            <ChevronUp className="w-5 h-5 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Expanded Details */}
                            {expandedId === announcement.id && (
                                <div className="px-4 pb-4 border-t border-slate-100 dark:border-zinc-900 pt-4 bg-slate-50 dark:bg-zinc-900/50">
                                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-4">
                                        {announcement.message}
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-500 text-xs uppercase font-bold mb-1">Created By</p>
                                            <p className="text-slate-900 dark:text-white font-medium">{announcement.createdByName}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-500 text-xs uppercase font-bold mb-1">Created At</p>
                                            <p className="text-slate-900 dark:text-white font-medium">{formatDate(announcement.createdAt)}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-500 text-xs uppercase font-bold mb-1">Expires</p>
                                            <p className="text-slate-900 dark:text-white font-medium">
                                                {announcement.expiresAt ? formatDate(announcement.expiresAt) : 'Never'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-500 text-xs uppercase font-bold mb-1">Target</p>
                                            <p className="text-slate-900 dark:text-white font-medium">
                                                {announcement.targetTeams === 'all' 
                                                    ? 'All Teams' 
                                                    : (announcement.targetTeams as string[]).join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Expired Announcements (collapsed by default) */}
            {expiredAnnouncements.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <History className="w-4 h-4" /> Expired Announcements ({expiredAnnouncements.length})
                    </h2>
                    <div className="space-y-2 opacity-60">
                        {expiredAnnouncements.slice(0, 5).map(announcement => (
                            <div 
                                key={announcement.id}
                                className="bg-slate-100 dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 p-3 flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-through">
                                        {announcement.title}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Expired {formatDate(announcement.expiresAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setAnnouncementToDelete(announcement);
                                        setDeleteModalOpen(true);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Announcement Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col">
                        <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Megaphone className="w-5 h-5 text-orange-500" />
                                New Announcement
                            </h2>
                            <button 
                                onClick={() => setCreateModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateAnnouncement} className="flex-1 overflow-y-auto p-5 space-y-4">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> {error}
                                </div>
                            )}
                            
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Schedule Change This Week"
                                    className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500"
                                    required
                                />
                            </div>
                            
                            {/* Message */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Message *
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Enter your announcement message..."
                                    rows={4}
                                    className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                                    required
                                />
                            </div>
                            
                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Priority
                                </label>
                                <div className="flex gap-2">
                                    {(['normal', 'important', 'urgent'] as const).map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPriority(p)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors capitalize ${
                                                priority === p 
                                                    ? getPriorityColor(p) 
                                                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Target Teams */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Target Teams
                                </label>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setTargetType('all')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                                            targetType === 'all'
                                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800'
                                                : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        <Globe className="w-4 h-4" /> All Teams
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTargetType('selected')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                                            targetType === 'selected'
                                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800'
                                                : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        <Target className="w-4 h-4" /> Select Teams
                                    </button>
                                </div>
                                
                                {targetType === 'selected' && (
                                    <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                                        <div className="p-2 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                                            <span className="text-xs text-slate-500">{selectedTeams.size} of {teams.length} selected</span>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={selectAllTeams} className="text-xs text-orange-600 hover:underline">Select All</button>
                                                <button type="button" onClick={deselectAllTeams} className="text-xs text-slate-500 hover:underline">Clear</button>
                                            </div>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                                            {teams.map(team => (
                                                <button
                                                    key={team.id}
                                                    type="button"
                                                    onClick={() => toggleTeamSelection(team.id)}
                                                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-left"
                                                >
                                                    {selectedTeams.has(team.id) ? (
                                                        <CheckSquare className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                    )}
                                                    <span className="text-sm text-slate-900 dark:text-white truncate">{team.name}</span>
                                                    <span className="text-xs text-slate-400 ml-auto">{team.id}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Expiration */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Expires After
                                </label>
                                <select
                                    value={expiresIn}
                                    onChange={(e) => setExpiresIn(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="never">Never</option>
                                    <option value="1day">1 Day</option>
                                    <option value="3days">3 Days</option>
                                    <option value="7days">7 Days</option>
                                    <option value="30days">30 Days</option>
                                </select>
                            </div>
                        </form>
                        
                        <div className="p-5 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setCreateModalOpen(false)}
                                disabled={isSending}
                                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateAnnouncement}
                                disabled={isSending}
                                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold transition-colors disabled:opacity-50"
                            >
                                {isSending ? (
                                    <>Sending...</>
                                ) : (
                                    <><Send className="w-4 h-4" /> Send Announcement</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && announcementToDelete && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-red-300 dark:border-red-800 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Delete Announcement?</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Are you sure you want to delete "<span className="font-medium text-slate-900 dark:text-white">{announcementToDelete.title}</span>"?
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                            Note: This will remove the announcement from this list but won't remove posts already sent to team bulletins.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setDeleteModalOpen(false); setAnnouncementToDelete(null); }}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAnnouncement}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Announcements;
