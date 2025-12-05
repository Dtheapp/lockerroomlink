import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, deleteDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Film, Play, Heart, Eye, Clock, User, Scissors, Check, X, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { FanClip } from '../../types';
import FanClipCreator from './FanClipCreator';

interface FanClipGalleryProps {
  teamId: string;
  playerId: string;
  playerName: string;
  parentId?: string;
}

const FanClipGallery: React.FC<FanClipGalleryProps> = ({
  teamId,
  playerId,
  playerName,
  parentId
}) => {
  const { user, userData } = useAuth();
  
  const [clips, setClips] = useState<FanClip[]>([]);
  const [pendingClips, setPendingClips] = useState<FanClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(false);
  
  const playerRefs = useRef<{ [key: string]: any }>({});

  const isParent = user && userData?.role === 'Parent' && user.uid === parentId;
  const isFan = user && userData?.role === 'Fan';

  // Load clips
  useEffect(() => {
    const loadClips = async () => {
      setLoading(true);
      try {
        const clipsRef = collection(db, 'teams', teamId, 'players', playerId, 'fanClips');
        
        // Get all clips and filter client-side to avoid composite index requirement
        const allClipsSnap = await getDocs(clipsRef);
        
        const approvedClips: FanClip[] = [];
        const pendingClipsList: FanClip[] = [];
        
        allClipsSnap.forEach((doc) => {
          const clip = { id: doc.id, ...doc.data() } as FanClip;
          if (clip.isApproved) {
            approvedClips.push(clip);
          } else if (!clip.isHidden) {
            pendingClipsList.push(clip);
          }
        });
        
        // Sort by createdAt descending
        approvedClips.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        
        setClips(approvedClips);
        
        // If parent, show pending clips
        if (isParent) {
          setPendingClips(pendingClipsList);
        }
        
      } catch (err) {
        console.error('Error loading clips:', err);
      } finally {
        setLoading(false);
      }
    };

    loadClips();
  }, [teamId, playerId, isParent]);

  const handleApproveClip = async (clipId: string) => {
    if (!isParent) return;
    
    try {
      await updateDoc(doc(db, 'teams', teamId, 'players', playerId, 'fanClips', clipId), {
        isApproved: true
      });
      
      // Move from pending to approved
      const clip = pendingClips.find(c => c.id === clipId);
      if (clip) {
        setPendingClips(pendingClips.filter(c => c.id !== clipId));
        setClips([{ ...clip, isApproved: true }, ...clips]);
      }
    } catch (err) {
      console.error('Error approving clip:', err);
    }
  };

  const handleRejectClip = async (clipId: string) => {
    if (!isParent) return;
    
    try {
      await updateDoc(doc(db, 'teams', teamId, 'players', playerId, 'fanClips', clipId), {
        isHidden: true,
        rejectionReason: 'Rejected by parent'
      });
      
      setPendingClips(pendingClips.filter(c => c.id !== clipId));
    } catch (err) {
      console.error('Error rejecting clip:', err);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!isParent) return;
    
    if (!confirm('Delete this clip permanently?')) return;
    
    try {
      await deleteDoc(doc(db, 'teams', teamId, 'players', playerId, 'fanClips', clipId));
      setClips(clips.filter(c => c.id !== clipId));
    } catch (err) {
      console.error('Error deleting clip:', err);
    }
  };

  const handleLikeClip = async (clipId: string) => {
    if (!user) return;
    
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    const hasLiked = clip.likes?.includes(user.uid);
    
    try {
      await updateDoc(doc(db, 'teams', teamId, 'players', playerId, 'fanClips', clipId), {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likeCount: increment(hasLiked ? -1 : 1)
      });
      
      setClips(clips.map(c => {
        if (c.id === clipId) {
          const newLikes = hasLiked 
            ? c.likes.filter(id => id !== user.uid)
            : [...c.likes, user.uid];
          return {
            ...c,
            likes: newLikes,
            likeCount: newLikes.length
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Error liking clip:', err);
    }
  };

  const handlePlayClip = async (clip: FanClip) => {
    setPlayingClipId(clip.id);
    
    // Increment view count
    try {
      await updateDoc(doc(db, 'teams', teamId, 'players', playerId, 'fanClips', clip.id), {
        viewCount: increment(1)
      });
    } catch (err) {
      console.error('Error updating view count:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Recently';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const handleClipCreated = (clip: FanClip) => {
    if (isParent) {
      // Auto-approve clips from parent
      setClips([{ ...clip, isApproved: true }, ...clips]);
    } else {
      setPendingClips([clip, ...pendingClips]);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Film className="text-purple-400" size={20} />
          Fan Highlights
          {clips.length > 0 && (
            <span className="bg-purple-500/20 text-purple-400 text-sm px-2 py-0.5 rounded-full">
              {clips.length}
            </span>
          )}
        </h3>
        
        {isFan && (
          <button
            onClick={() => setShowCreator(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
          >
            <Scissors size={14} />
            Create Clip
          </button>
        )}
      </div>

      {/* Parent: Pending Clips */}
      {isParent && pendingClips.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowPending(!showPending)}
            className="w-full flex items-center justify-between px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span className="font-medium">{pendingClips.length} clips pending approval</span>
            </div>
            {showPending ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {showPending && (
            <div className="mt-3 space-y-3">
              {pendingClips.map((clip) => (
                <div key={clip.id} className="bg-zinc-800/50 rounded-lg p-3 border border-yellow-500/20">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-24 h-16 rounded overflow-hidden bg-zinc-900 flex-shrink-0">
                      <img
                        src={`https://img.youtube.com/vi/${clip.youtubeId}/mqdefault.jpg`}
                        alt={clip.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{clip.title}</h4>
                      <p className="text-xs text-zinc-400">
                        By {clip.creatorName} • {formatTime(clip.endTime - clip.startTime)} clip
                      </p>
                      {clip.description && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{clip.description}</p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApproveClip(clip.id)}
                        className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                        title="Approve"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleRejectClip(clip.id)}
                        className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
                        title="Reject"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clips Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clips.length === 0 ? (
        <div className="text-center py-8">
          <Film className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No fan highlights yet</p>
          {isFan && (
            <p className="text-zinc-500 text-sm mt-1">
              Be the first to create a highlight clip for {playerName}!
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className="bg-zinc-800/50 rounded-lg overflow-hidden border border-zinc-700 hover:border-purple-500/50 transition-colors"
            >
              {/* Video/Thumbnail */}
              {playingClipId === clip.id ? (
                <div className="relative aspect-video">
                  <iframe
                    src={`https://www.youtube.com/embed/${clip.youtubeId}?autoplay=1&start=${Math.floor(clip.startTime)}&end=${Math.floor(clip.endTime)}`}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                  <button
                    onClick={() => setPlayingClipId(null)}
                    className="absolute top-2 right-2 p-1 bg-black/70 rounded text-white hover:bg-black"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div 
                  className="relative aspect-video cursor-pointer group"
                  onClick={() => handlePlayClip(clip)}
                >
                  <img
                    src={`https://img.youtube.com/vi/${clip.youtubeId}/mqdefault.jpg`}
                    alt={clip.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                      <Play className="text-white ml-1" size={24} />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded flex items-center gap-1">
                    <Clock size={12} />
                    {formatTime(clip.endTime - clip.startTime)}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-3">
                <h4 className="font-medium text-white truncate mb-1">{clip.title}</h4>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                  <User size={12} />
                  <span>{clip.creatorName}</span>
                  <span>•</span>
                  <span>{formatDate(clip.createdAt)}</span>
                </div>
                
                {clip.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{clip.description}</p>
                )}

                {/* Stats & Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleLikeClip(clip.id)}
                      disabled={!user}
                      className={`flex items-center gap-1 text-sm ${
                        clip.likes?.includes(user?.uid || '') 
                          ? 'text-red-400' 
                          : 'text-zinc-400 hover:text-red-400'
                      } transition-colors`}
                    >
                      <Heart size={14} fill={clip.likes?.includes(user?.uid || '') ? 'currentColor' : 'none'} />
                      {clip.likeCount || 0}
                    </button>
                    <div className="flex items-center gap-1 text-sm text-zinc-500">
                      <Eye size={14} />
                      {clip.viewCount || 0}
                    </div>
                  </div>
                  
                  {isParent && (
                    <button
                      onClick={() => handleDeleteClip(clip.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete clip"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clip Creator Modal */}
      {showCreator && (
        <FanClipCreator
          teamId={teamId}
          playerId={playerId}
          playerName={playerName}
          onClose={() => setShowCreator(false)}
          onClipCreated={handleClipCreated}
        />
      )}
    </div>
  );
};

export default FanClipGallery;
