import React, { useState, useEffect } from 'react';
import { 
    collection, getDocs, deleteDoc, doc, addDoc, serverTimestamp,
    query, orderBy, limit, Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Team } from '../../types';
import { 
    ShieldAlert, MessageCircle, FileText, Trash2, Check, X,
    AlertTriangle, Search, Filter, Eye, ChevronDown, ChevronUp,
    RefreshCw, Clock, User, Flag, CheckCircle, Ban
} from 'lucide-react';

interface ContentItem {
    id: string;
    teamId: string;
    teamName: string;
    type: 'message' | 'post';
    text: string;
    author: string;
    authorId?: string;
    timestamp: Timestamp | null;
    flagged?: boolean;
}

type FilterType = 'all' | 'messages' | 'posts';
type SortType = 'newest' | 'oldest';

const ContentModeration: React.FC = () => {
    const { userData } = useAuth();
    const [content, setContent] = useState<ContentItem[]>([]);
    const [teams, setTeams] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [sortType, setSortType] = useState<SortType>('newest');
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    
    // Modal states
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Stats
    const [stats, setStats] = useState({ total: 0, messages: 0, posts: 0, deleted: 0 });

    useEffect(() => {
        fetchAllContent();
    }, []);

    const fetchAllContent = async () => {
        setLoading(true);
        try {
            // Fetch all teams first
            const teamsSnapshot = await getDocs(collection(db, 'teams'));
            const teamsMap: { [key: string]: string } = {};
            teamsSnapshot.docs.forEach(doc => {
                const data = doc.data() as Team;
                teamsMap[doc.id] = data.name;
            });
            setTeams(teamsMap);

            const allContent: ContentItem[] = [];

            // Fetch messages and posts from each team
            for (const teamDoc of teamsSnapshot.docs) {
                const teamId = teamDoc.id;
                const teamName = teamsMap[teamId];

                // Fetch recent messages (limit to 50 per team for performance)
                const messagesQuery = query(
                    collection(db, 'teams', teamId, 'messages'),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
                const messagesSnapshot = await getDocs(messagesQuery);
                messagesSnapshot.docs.forEach(msgDoc => {
                    const data = msgDoc.data();
                    allContent.push({
                        id: msgDoc.id,
                        teamId,
                        teamName,
                        type: 'message',
                        text: data.text || '',
                        author: data.sender?.name || data.senderName || 'Unknown',
                        authorId: data.sender?.id || data.senderId,
                        timestamp: data.timestamp || null,
                        flagged: data.flagged || false
                    });
                });

                // Fetch recent posts (limit to 50 per team)
                const postsQuery = query(
                    collection(db, 'teams', teamId, 'bulletin'),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
                const postsSnapshot = await getDocs(postsQuery);
                postsSnapshot.docs.forEach(postDoc => {
                    const data = postDoc.data();
                    allContent.push({
                        id: postDoc.id,
                        teamId,
                        teamName,
                        type: 'post',
                        text: data.text || '',
                        author: data.author || 'Unknown',
                        authorId: data.authorId,
                        timestamp: data.timestamp || null,
                        flagged: data.flagged || false
                    });
                });
            }

            setContent(allContent);
            setStats({
                total: allContent.length,
                messages: allContent.filter(c => c.type === 'message').length,
                posts: allContent.filter(c => c.type === 'post').length,
                deleted: 0
            });
        } catch (error) {
            console.error('Error fetching content:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAllContent();
        setRefreshing(false);
    };

    const handleDelete = async () => {
        if (!selectedItem) return;
        setIsDeleting(true);

        try {
            const collectionName = selectedItem.type === 'message' ? 'messages' : 'bulletin';
            await deleteDoc(doc(db, 'teams', selectedItem.teamId, collectionName, selectedItem.id));

            // Log activity
            await addDoc(collection(db, 'adminActivityLog'), {
                action: 'DELETE',
                targetType: selectedItem.type,
                targetId: selectedItem.id,
                details: `Moderated ${selectedItem.type} from team "${selectedItem.teamName}" by ${selectedItem.author}: "${selectedItem.text.substring(0, 50)}..."`,
                performedBy: userData?.uid || 'unknown',
                performedByName: userData?.name || 'Unknown Admin',
                timestamp: serverTimestamp()
            });

            // Remove from local state
            setContent(prev => prev.filter(c => !(c.id === selectedItem.id && c.teamId === selectedItem.teamId)));
            setStats(prev => ({ 
                ...prev, 
                deleted: prev.deleted + 1,
                total: prev.total - 1,
                messages: selectedItem.type === 'message' ? prev.messages - 1 : prev.messages,
                posts: selectedItem.type === 'post' ? prev.posts - 1 : prev.posts
            }));
            
            setDeleteModalOpen(false);
            setSelectedItem(null);
        } catch (error) {
            console.error('Error deleting content:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleExpand = (itemId: string, teamId: string) => {
        const key = `${teamId}-${itemId}`;
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const formatTimestamp = (timestamp: Timestamp | null) => {
        if (!timestamp) return 'Unknown';
        return timestamp.toDate().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    // Filter and sort content
    const filteredContent = content
        .filter(item => {
            const matchesSearch = 
                item.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.teamName.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterType === 'all' || 
                (filterType === 'messages' && item.type === 'message') ||
                (filterType === 'posts' && item.type === 'post');
            const matchesTeam = selectedTeam === 'all' || item.teamId === selectedTeam;
            return matchesSearch && matchesType && matchesTeam;
        })
        .sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            const comparison = b.timestamp.toMillis() - a.timestamp.toMillis();
            return sortType === 'newest' ? comparison : -comparison;
        });

    const uniqueTeams = [...new Set(content.map(c => c.teamId))];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-orange-500" />
                        Content Moderation
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Review and manage content across all teams
                    </p>
                </div>
                <button 
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-zinc-800"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Total Items</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-1">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Messages</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.messages}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Posts</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.posts}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                        <Ban className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">Removed</span>
                    </div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.deleted}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search content, author, or team..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>

                {/* Type Filter */}
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as FilterType)}
                    className="px-4 py-2 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                >
                    <option value="all">All Types</option>
                    <option value="messages">Messages Only</option>
                    <option value="posts">Posts Only</option>
                </select>

                {/* Team Filter */}
                <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                >
                    <option value="all">All Teams</option>
                    {uniqueTeams.map(teamId => (
                        <option key={teamId} value={teamId}>{teams[teamId] || teamId}</option>
                    ))}
                </select>

                {/* Sort */}
                <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value as SortType)}
                    className="px-4 py-2 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
                </div>
            ) : filteredContent.length === 0 ? (
                <div className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 p-12 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                    <p className="text-slate-600 dark:text-slate-400 text-lg">No content to review</p>
                    <p className="text-slate-500 dark:text-slate-500 text-sm mt-1">
                        {searchQuery || filterType !== 'all' || selectedTeam !== 'all' 
                            ? 'Try adjusting your filters' 
                            : 'All content looks good!'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredContent.map(item => {
                        const key = `${item.teamId}-${item.id}`;
                        const isExpanded = expandedItems.has(key);
                        const isLongText = item.text.length > 150;

                        return (
                            <div 
                                key={key}
                                className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            {/* Header */}
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                    item.type === 'message' 
                                                        ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                                                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                }`}>
                                                    {item.type}
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400">
                                                    {item.teamName}
                                                </span>
                                                {item.flagged && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center gap-1">
                                                        <Flag className="w-3 h-3" /> Flagged
                                                    </span>
                                                )}
                                            </div>

                                            {/* Author & Time */}
                                            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mb-2">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {item.author}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {formatTimestamp(item.timestamp)}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <p className={`text-slate-700 dark:text-slate-300 whitespace-pre-wrap ${!isExpanded && isLongText ? 'line-clamp-2' : ''}`}>
                                                {item.text}
                                            </p>

                                            {/* Expand/Collapse */}
                                            {isLongText && (
                                                <button
                                                    onClick={() => toggleExpand(item.id, item.teamId)}
                                                    className="text-sm text-orange-600 dark:text-orange-400 hover:underline mt-1 flex items-center gap-1"
                                                >
                                                    {isExpanded ? (
                                                        <><ChevronUp className="w-3 h-3" /> Show less</>
                                                    ) : (
                                                        <><ChevronDown className="w-3 h-3" /> Show more</>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setDeleteModalOpen(true);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Remove content"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Results count */}
            {!loading && filteredContent.length > 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Showing {filteredContent.length} of {content.length} items
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && selectedItem && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-950 p-6 rounded-xl w-full max-w-md border border-red-300 dark:border-red-800 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Remove Content?</h2>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-slate-600 dark:text-slate-400 mb-3">
                                Are you sure you want to remove this {selectedItem.type}?
                            </p>
                            <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 border border-slate-200 dark:border-zinc-800">
                                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                    <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                                        selectedItem.type === 'message' 
                                            ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400'
                                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                    }`}>
                                        {selectedItem.type}
                                    </span>
                                    <span>from {selectedItem.teamName}</span>
                                    <span>by {selectedItem.author}</span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                                    {selectedItem.text}
                                </p>
                            </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setDeleteModalOpen(false); setSelectedItem(null); }}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? 'Removing...' : <><Trash2 className="w-4 h-4" /> Remove</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContentModeration;
