import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { uploadFile, deleteFile } from '../../services/storage';
import { sanitizeText } from '../../services/sanitize';
import type { AthletePost, Player } from '../../types';
import AthletePostCard from './AthletePostCard';
import { Plus, Image, X, Loader2, FileText, AlertTriangle } from 'lucide-react';

interface AthletePostsProps {
  teamId: string;
  playerId: string;
  player: Player;
  parentId?: string;
}

const AthletePosts: React.FC<AthletePostsProps> = ({ teamId, playerId, player, parentId }) => {
  const { user, userData } = useAuth();
  const [posts, setPosts] = useState<AthletePost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create post state
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isParentModerator = userData?.role === 'Parent' && user?.uid === parentId;

  // Load posts
  useEffect(() => {
    const postsRef = collection(db, 'teams', teamId, 'players', playerId, 'posts');
    const q = query(postsRef, orderBy('isPinned', 'desc'), orderBy('createdAt', 'desc'), limit(20));

    const unsub = onSnapshot(q, (snap) => {
      const postList = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AthletePost))
        .filter(p => !p.isHidden);
      setPosts(postList);
      setLoading(false);
    });

    return () => unsub();
  }, [teamId, playerId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }

    setNewPostImage(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleCreatePost = async () => {
    if (!user || !userData || !isParentModerator) return;
    if (!newPostText.trim() && !newPostImage) {
      setError('Please add some text or an image');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      let imageUrl: string | undefined;
      let imagePath: string | undefined;

      // Upload image if selected
      if (newPostImage) {
        const path = `athlete-posts/${teamId}/${playerId}/${Date.now()}_${newPostImage.name}`;
        const uploaded = await uploadFile(newPostImage, path);
        imageUrl = typeof uploaded === 'string' ? uploaded : uploaded.url;
        imagePath = path;
      }

      const sanitizedText = sanitizeText(newPostText.trim());

      const postData: Partial<AthletePost> = {
        text: sanitizedText,
        ...(imageUrl && { imageUrl, imagePath }),
        authorId: user.uid,
        authorName: userData.name || 'Parent',
        athleteId: playerId,
        athleteName: player.name,
        ...(player.photoUrl && { athletePhotoUrl: player.photoUrl }),
        createdAt: serverTimestamp(),
        likes: [],
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        isHidden: false
      };

      const postsRef = collection(db, 'teams', teamId, 'players', playerId, 'posts');
      await addDoc(postsRef, postData);

      // Reset form
      setNewPostText('');
      setNewPostImage(null);
      setImagePreview(null);
      setShowCreatePost(false);
    } catch (err: any) {
      console.error('Error creating post:', err);
      setError(err.message || 'Failed to create post');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!isParentModerator) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      // Delete image if exists
      if (post.imagePath) {
        await deleteFile(post.imagePath);
      }

      // Delete post document
      await deleteDoc(doc(db, 'teams', teamId, 'players', playerId, 'posts', postId));
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const handleTogglePin = async (postId: string, isPinned: boolean) => {
    if (!isParentModerator) return;

    try {
      // If pinning, unpin any other pinned posts first
      if (isPinned) {
        for (const p of posts) {
          if (p.isPinned && p.id !== postId) {
            await updateDoc(doc(db, 'teams', teamId, 'players', playerId, 'posts', p.id), {
              isPinned: false
            });
          }
        }
      }

      await updateDoc(doc(db, 'teams', teamId, 'players', playerId, 'posts', postId), {
        isPinned
      });
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Posts
        </h2>
        {isParentModerator && (
          <button
            onClick={() => setShowCreatePost(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreatePost && isParentModerator && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-lg">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white">Create Post for {player.name}</h3>
              <button
                onClick={() => {
                  setShowCreatePost(false);
                  setNewPostText('');
                  setNewPostImage(null);
                  setImagePreview(null);
                  setError(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg overflow-hidden">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="break-words overflow-hidden">{error}</span>
                </div>
              )}

              {/* Post Author Preview */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden">
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-lg font-bold">
                      {player.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">{player.name}</p>
                  <p className="text-xs text-zinc-500">Posting as athlete</p>
                </div>
              </div>

              {/* Text Input */}
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder={`What's on ${player.name.split(' ')[0]}'s mind?`}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={4}
                maxLength={1000}
              />

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                  <button
                    onClick={() => {
                      setNewPostImage(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 text-white rounded-full hover:bg-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Image Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-zinc-400 hover:text-purple-400 transition-colors text-sm"
              >
                <Image className="w-5 h-5" />
                Add Photo
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 flex gap-3">
              <button
                onClick={handleCreatePost}
                disabled={creating || (!newPostText.trim() && !newPostImage)}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Post
              </button>
              <button
                onClick={() => {
                  setShowCreatePost(false);
                  setNewPostText('');
                  setNewPostImage(null);
                  setImagePreview(null);
                  setError(null);
                }}
                disabled={creating}
                className="px-6 py-2.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts Feed */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
          <FileText className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400">No posts yet</p>
          {isParentModerator && (
            <p className="text-sm text-zinc-500 mt-1">
              Share updates, achievements, and moments with fans!
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <AthletePostCard
              key={post.id}
              post={post}
              teamId={teamId}
              playerId={playerId}
              isParentModerator={isParentModerator}
              onDelete={handleDeletePost}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AthletePosts;
