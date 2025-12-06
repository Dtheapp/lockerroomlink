import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { CoachAnnouncement } from '../../types';
import { Megaphone, Plus, Heart, MessageSquare, Pin, Trash2, Edit2, X, Loader2, ChevronDown, Send, Clock } from 'lucide-react';

interface CoachAnnouncementsProps {
  coachId: string;
  coachName: string;
}

interface AnnouncementComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: any;
}

const CoachAnnouncements: React.FC<CoachAnnouncementsProps> = ({ coachId, coachName }) => {
  const { user, userData } = useAuth();
  const [announcements, setAnnouncements] = useState<CoachAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<CoachAnnouncement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Comments
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, AnnouncementComment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [sendingComment, setSendingComment] = useState<Record<string, boolean>>({});

  const isCoachOwner = user?.uid === coachId;

  // Load announcements
  useEffect(() => {
    const announcementsRef = collection(db, 'users', coachId, 'announcements');
    const q = query(announcementsRef, orderBy('isPinned', 'desc'), orderBy('createdAt', 'desc'), limit(20));
    
    const unsub = onSnapshot(q, (snap) => {
      const anns = snap.docs.map(d => ({ id: d.id, ...d.data() } as CoachAnnouncement));
      setAnnouncements(anns.filter(a => a.isPublic || isCoachOwner));
      setLoading(false);
    });

    return () => unsub();
  }, [coachId, isCoachOwner]);

  // Load comments for expanded announcements
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    
    Object.keys(expandedComments).forEach(annId => {
      if (expandedComments[annId]) {
        const commentsRef = collection(db, 'users', coachId, 'announcements', annId, 'comments');
        const q = query(commentsRef, orderBy('createdAt', 'asc'));
        
        const unsub = onSnapshot(q, (snap) => {
          const cmts = snap.docs.map(d => ({ id: d.id, ...d.data() } as AnnouncementComment));
          setComments(prev => ({ ...prev, [annId]: cmts }));
        });
        
        unsubscribes.push(unsub);
      }
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [expandedComments, coachId]);

  const handleCreateAnnouncement = async () => {
    if (!user || !userData || !title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const announcementData: Record<string, any> = {
        title: title.trim(),
        content: content.trim(),
        authorId: user.uid,
        authorName: userData.name,
        createdAt: serverTimestamp(),
        isPinned,
        likes: [],
        likeCount: 0,
        commentCount: 0,
        isPublic: true
      };

      if (editingAnnouncement) {
        announcementData.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'users', coachId, 'announcements', editingAnnouncement.id), announcementData);
      } else {
        await addDoc(collection(db, 'users', coachId, 'announcements'), announcementData);
      }

      setShowModal(false);
      setEditingAnnouncement(null);
      setTitle('');
      setContent('');
      setIsPinned(false);
    } catch (err) {
      console.error('Error saving announcement:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!confirm('Delete this announcement?')) return;

    try {
      await deleteDoc(doc(db, 'users', coachId, 'announcements', annId));
    } catch (err) {
      console.error('Error deleting announcement:', err);
    }
  };

  const handleLike = async (ann: CoachAnnouncement) => {
    if (!user) return;

    try {
      const annRef = doc(db, 'users', coachId, 'announcements', ann.id);
      const hasLiked = ann.likes?.includes(user.uid);

      if (hasLiked) {
        await updateDoc(annRef, {
          likes: arrayRemove(user.uid),
          likeCount: (ann.likeCount || 1) - 1
        });
      } else {
        await updateDoc(annRef, {
          likes: arrayUnion(user.uid),
          likeCount: (ann.likeCount || 0) + 1
        });
      }
    } catch (err) {
      console.error('Error liking announcement:', err);
    }
  };

  const handleTogglePin = async (ann: CoachAnnouncement) => {
    if (!isCoachOwner) return;

    try {
      await updateDoc(doc(db, 'users', coachId, 'announcements', ann.id), {
        isPinned: !ann.isPinned
      });
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleSendComment = async (annId: string) => {
    if (!user || !userData || !newComment[annId]?.trim()) return;

    setSendingComment(prev => ({ ...prev, [annId]: true }));
    try {
      const commentData: Record<string, any> = {
        text: newComment[annId].trim(),
        authorId: user.uid,
        authorName: userData.name,
        authorRole: userData.role,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'users', coachId, 'announcements', annId, 'comments'), commentData);
      
      // Update comment count
      const ann = announcements.find(a => a.id === annId);
      if (ann) {
        await updateDoc(doc(db, 'users', coachId, 'announcements', annId), {
          commentCount: (ann.commentCount || 0) + 1
        });
      }

      setNewComment(prev => ({ ...prev, [annId]: '' }));
    } catch (err) {
      console.error('Error sending comment:', err);
    } finally {
      setSendingComment(prev => ({ ...prev, [annId]: false }));
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Coach': return 'bg-blue-500/20 text-blue-400';
      case 'Parent': return 'bg-green-500/20 text-green-400';
      case 'Fan': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  return (
    <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-zinc-700 cursor-pointer hover:bg-zinc-700/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">Announcements</h3>
            <p className="text-xs text-zinc-500">{announcements.length} {announcements.length === 1 ? 'post' : 'posts'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCoachOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingAnnouncement(null);
                setTitle('');
                setContent('');
                setIsPinned(false);
                setShowModal(true);
              }}
              className="p-2 text-amber-400 hover:text-amber-300 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
          <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isExpanded && (
        <div className="divide-y divide-zinc-700/50">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No announcements yet</p>
              {isCoachOwner && (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-3 text-amber-400 hover:text-amber-300 text-sm"
                >
                  Create your first announcement →
                </button>
              )}
            </div>
          ) : (
            announcements.map((ann) => {
              const hasLiked = ann.likes?.includes(user?.uid || '');
              const isCommentsExpanded = expandedComments[ann.id];
              const annComments = comments[ann.id] || [];

              return (
                <div key={ann.id} className="p-4">
                  {/* Pinned badge */}
                  {ann.isPinned && (
                    <div className="flex items-center gap-1 text-amber-400 text-xs mb-2">
                      <Pin className="w-3 h-3" />
                      Pinned
                    </div>
                  )}

                  {/* Title & Actions */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h4 className="font-bold text-white text-lg">{ann.title}</h4>
                    {isCoachOwner && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePin(ann)}
                          className={`p-1.5 rounded transition-colors ${ann.isPinned ? 'text-amber-400 bg-amber-500/20' : 'text-zinc-500 hover:text-amber-400'}`}
                          title={ann.isPinned ? 'Unpin' : 'Pin'}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingAnnouncement(ann);
                            setTitle(ann.title);
                            setContent(ann.content);
                            setIsPinned(ann.isPinned || false);
                            setShowModal(true);
                          }}
                          className="p-1.5 text-zinc-500 hover:text-blue-400 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap mb-3">{ann.content}</p>

                  {/* Meta & Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(ann.createdAt)}
                      {ann.updatedAt && ' (edited)'}
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Like */}
                      <button
                        onClick={() => handleLike(ann)}
                        disabled={!user}
                        className={`flex items-center gap-1 text-sm transition-colors ${
                          hasLiked ? 'text-pink-500' : 'text-zinc-500 hover:text-pink-400'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${hasLiked ? 'fill-current' : ''}`} />
                        {ann.likeCount > 0 && <span>{ann.likeCount}</span>}
                      </button>

                      {/* Comments */}
                      <button
                        onClick={() => setExpandedComments(prev => ({ ...prev, [ann.id]: !prev[ann.id] }))}
                        className={`flex items-center gap-1 text-sm transition-colors ${
                          isCommentsExpanded ? 'text-blue-400' : 'text-zinc-500 hover:text-blue-400'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {ann.commentCount > 0 && <span>{ann.commentCount}</span>}
                      </button>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {isCommentsExpanded && (
                    <div className="mt-4 pt-4 border-t border-zinc-700/50">
                      {/* Existing Comments */}
                      {annComments.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {annComments.map((comment) => (
                            <div key={comment.id} className="flex gap-2">
                              <div className="w-7 h-7 bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-zinc-400">{comment.authorName.charAt(0)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-medium text-zinc-300">{comment.authorName}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeColor(comment.authorRole)}`}>
                                    {comment.authorRole}
                                  </span>
                                </div>
                                <p className="text-sm text-zinc-400">{comment.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment */}
                      {user ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newComment[ann.id] || ''}
                            onChange={(e) => setNewComment(prev => ({ ...prev, [ann.id]: e.target.value }))}
                            placeholder="Add a comment..."
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendComment(ann.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleSendComment(ann.id)}
                            disabled={sendingComment[ann.id] || !newComment[ann.id]?.trim()}
                            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50"
                          >
                            {sendingComment[ann.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500 text-center">
                          <a href="#/auth" className="text-blue-400 hover:text-blue-300">Sign in</a> to comment
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What would you like to announce?"
                  rows={5}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-amber-500"
                />
                <span className="text-sm text-zinc-300">Pin to top</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAnnouncement}
                disabled={submitting || !title.trim() || !content.trim()}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : editingAnnouncement ? (
                  'Update'
                ) : (
                  'Post Announcement'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachAnnouncements;
