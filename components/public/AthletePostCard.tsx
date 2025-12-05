import React, { useState, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { sanitizeText } from '../../services/sanitize';
import type { AthletePost, PostComment } from '../../types';
import { Heart, MessageCircle, Send, User, MoreVertical, Trash2, Pin, PinOff, Eye, EyeOff, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface AthletePostCardProps {
  post: AthletePost;
  teamId: string;
  playerId: string;
  isParentModerator: boolean;
  onDelete?: (postId: string) => void;
  onTogglePin?: (postId: string, isPinned: boolean) => void;
}

const AthletePostCard: React.FC<AthletePostCardProps> = ({
  post,
  teamId,
  playerId,
  isParentModerator,
  onDelete,
  onTogglePin
}) => {
  const { user, userData } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentAsAthlete, setCommentAsAthlete] = useState(false);

  const hasLiked = user && post.likes?.includes(user.uid);
  const canComment = user && (userData?.role === 'Fan' || isParentModerator);

  // Load comments when expanded
  useEffect(() => {
    if (!showComments) return;

    setLoadingComments(true);
    const commentsRef = collection(db, 'teams', teamId, 'players', playerId, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'), limit(50));

    const unsub = onSnapshot(q, (snap) => {
      const cmts = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as PostComment))
        .filter(c => !c.isDeleted);
      setComments(cmts);
      setLoadingComments(false);
    });

    return () => unsub();
  }, [showComments, teamId, playerId, post.id]);

  const handleLike = async () => {
    if (!user) return;

    try {
      const postRef = doc(db, 'teams', teamId, 'players', playerId, 'posts', post.id);
      
      if (hasLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.uid),
          likeCount: Math.max(0, (post.likeCount || 1) - 1)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid),
          likeCount: (post.likeCount || 0) + 1
        });
      }
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !newComment.trim()) return;

    setSendingComment(true);
    try {
      const sanitizedText = sanitizeText(newComment.trim());
      
      const commentData: Partial<PostComment> = {
        postId: post.id,
        text: sanitizedText,
        authorId: user.uid,
        authorName: userData.name || 'Anonymous',
        authorUsername: userData.username || '',
        authorRole: userData.role as 'Fan' | 'Parent',
        authorPhotoUrl: userData.photoUrl || undefined,
        createdAt: serverTimestamp(),
        likes: [],
        likeCount: 0
      };

      // If parent is commenting as athlete
      if (commentAsAthlete && isParentModerator) {
        commentData.isAthleteComment = true;
        commentData.athleteId = playerId;
        commentData.athleteName = post.athleteName;
        commentData.authorRole = 'Athlete';
        commentData.authorName = post.athleteName;
        commentData.authorPhotoUrl = post.athletePhotoUrl;
      }

      const commentsRef = collection(db, 'teams', teamId, 'players', playerId, 'posts', post.id, 'comments');
      await addDoc(commentsRef, commentData);

      // Update comment count on post
      const postRef = doc(db, 'teams', teamId, 'players', playerId, 'posts', post.id);
      await updateDoc(postRef, {
        commentCount: (post.commentCount || 0) + 1
      });

      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = async (comment: PostComment) => {
    if (!isParentModerator) return;

    try {
      const commentRef = doc(db, 'teams', teamId, 'players', playerId, 'posts', post.id, 'comments', comment.id);
      await updateDoc(commentRef, {
        isDeleted: true,
        deletedBy: user?.uid
      });

      // Decrement comment count
      const postRef = doc(db, 'teams', teamId, 'players', playerId, 'posts', post.id);
      await updateDoc(postRef, {
        commentCount: Math.max(0, (post.commentCount || 1) - 1)
      });
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleLikeComment = async (comment: PostComment) => {
    if (!user) return;

    try {
      const commentRef = doc(db, 'teams', teamId, 'players', playerId, 'posts', post.id, 'comments', comment.id);
      const hasLikedComment = comment.likes?.includes(user.uid);

      if (hasLikedComment) {
        await updateDoc(commentRef, {
          likes: arrayRemove(user.uid),
          likeCount: Math.max(0, (comment.likeCount || 1) - 1)
        });
      } else {
        await updateDoc(commentRef, {
          likes: arrayUnion(user.uid),
          likeCount: (comment.likeCount || 0) + 1
        });
      }
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`bg-zinc-900 rounded-xl border ${post.isPinned ? 'border-orange-500/50' : 'border-zinc-800'} overflow-hidden`}>
      {/* Pinned Badge */}
      {post.isPinned && (
        <div className="bg-orange-600/20 px-4 py-1.5 flex items-center gap-2 text-orange-400 text-xs font-medium border-b border-orange-500/30">
          <Pin className="w-3 h-3" />
          Pinned Post
        </div>
      )}

      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden">
            {post.athletePhotoUrl ? (
              <img src={post.athletePhotoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-white">{post.athleteName}</p>
            <p className="text-xs text-zinc-500">{formatTimestamp(post.createdAt)}</p>
          </div>
        </div>

        {/* Menu for moderators */}
        {isParentModerator && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 py-1 min-w-[160px]">
                  <button
                    onClick={() => {
                      onTogglePin?.(post.id, !post.isPinned);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                  >
                    {post.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    {post.isPinned ? 'Unpin Post' : 'Pin Post'}
                  </button>
                  <button
                    onClick={() => {
                      onDelete?.(post.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Post
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <p className="text-zinc-100 whitespace-pre-wrap">{post.text}</p>
      </div>

      {/* Post Image */}
      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img 
            src={post.imageUrl} 
            alt="Post" 
            className="w-full rounded-lg max-h-96 object-cover"
          />
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-4 text-sm text-zinc-500">
        <span>{post.likeCount || 0} {post.likeCount === 1 ? 'like' : 'likes'}</span>
        <span>{post.commentCount || 0} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-2">
        <button
          onClick={handleLike}
          disabled={!user}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
            hasLiked 
              ? 'text-pink-500 bg-pink-500/10' 
              : 'text-zinc-400 hover:bg-zinc-800'
          }`}
        >
          <Heart className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
          <span className="text-sm font-medium">Like</span>
        </button>
        
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Comment</span>
          {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-zinc-800">
          {/* Comment List */}
          <div className="max-h-64 overflow-y-auto">
            {loadingComments ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-sm">
                No comments yet. Be the first!
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {comments.map((comment) => {
                  const hasLikedComment = user && comment.likes?.includes(user.uid);
                  
                  return (
                    <div key={comment.id} className="flex gap-2 group">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                        {comment.authorPhotoUrl ? (
                          <img src={comment.authorPhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-zinc-800 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-medium ${
                              comment.isAthleteComment ? 'text-orange-400' : 
                              comment.authorRole === 'Parent' ? 'text-sky-400' : 
                              'text-purple-400'
                            }`}>
                              {comment.isAthleteComment ? comment.athleteName : comment.authorName}
                            </span>
                            {comment.isAthleteComment && (
                              <span className="px-1.5 py-0.5 bg-orange-600/20 text-orange-400 text-[10px] rounded">ATHLETE</span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-200 break-words">{comment.text}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 px-1">
                          <span className="text-[10px] text-zinc-600">{formatTimestamp(comment.createdAt)}</span>
                          <button
                            onClick={() => handleLikeComment(comment)}
                            className={`text-[10px] font-medium ${hasLikedComment ? 'text-pink-500' : 'text-zinc-500 hover:text-pink-400'}`}
                          >
                            {hasLikedComment ? 'Liked' : 'Like'} {comment.likeCount > 0 && `(${comment.likeCount})`}
                          </button>
                          {isParentModerator && (
                            <button
                              onClick={() => handleDeleteComment(comment)}
                              className="text-[10px] text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comment Input */}
          {canComment && (
            <div className="p-3 border-t border-zinc-800">
              {/* Comment as athlete toggle */}
              {isParentModerator && (
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commentAsAthlete}
                      onChange={(e) => setCommentAsAthlete(e.target.checked)}
                      className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-orange-500 focus:ring-orange-500"
                    />
                    <span>Comment as <span className="text-orange-400">{post.athleteName}</span></span>
                  </label>
                </div>
              )}
              
              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={commentAsAthlete ? `Reply as ${post.athleteName}...` : "Write a comment..."}
                  maxLength={500}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  disabled={sendingComment || !newComment.trim()}
                  className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-500 transition-colors disabled:opacity-50"
                >
                  {sendingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          )}

          {!canComment && !user && (
            <div className="p-3 border-t border-zinc-800 text-center">
              <a href="#/auth" className="text-purple-400 hover:text-purple-300 text-sm">
                Sign in to comment →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AthletePostCard;
