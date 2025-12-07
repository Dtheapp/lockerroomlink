
const getCategoryStyle = (category: VideoCategory) => {
  const cat = VIDEO_CATEGORIES.find(c => c.value === category);
  return cat?.color || 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
};

const getCategoryIcon = (category: VideoCategory) => {
  const cat = VIDEO_CATEGORIES.find(c => c.value === category);
  return cat?.icon || <FolderOpen className="w-4 h-4" />;
};
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, getDocs, setDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Video, VideoCategory, Player, PlayerFilmEntry, Team } from '../types';
import EmptyState from './ui/EmptyState';
// VideoCard component with YouTube availability check
const VideoCard: React.FC<{ video: any, userData: any, openEditModal: any, setDeleteVideoConfirm: any, setPlayingVideoId: any, getCategoryStyle: any, getCategoryIcon: any }> = ({ video, userData, openEditModal, setDeleteVideoConfirm, setPlayingVideoId, getCategoryStyle, getCategoryIcon }) => {
  const [isAvailable, setIsAvailable] = React.useState(true);
  React.useEffect(() => {
    // Check YouTube oEmbed API for video availability
    if (video.youtubeId) {
      axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${video.youtubeId}&format=json`)
        .then(() => setIsAvailable(true))
        .catch(() => setIsAvailable(false));
    }
  }, [video.youtubeId]);

  if (!isAvailable) {
    // Optionally, auto-delete after 24h if still unavailable
    // (not implemented here, but can be added with a scheduled job)
    return null;
  }

  return (
    <div 
      key={video.id} 
      className={`bg-white dark:bg-zinc-950 rounded-xl border overflow-hidden shadow-lg hover:shadow-xl transition-all group ${
        video.playerId 
          ? 'border-purple-500/30 ring-1 ring-purple-500/10' 
          : 'border-zinc-200 dark:border-zinc-800 hover:border-purple-500/30'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black cursor-pointer" onClick={() => setPlayingVideoId(video.youtubeId)}>
        <img 
          src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`} 
          alt={video.title} 
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-colors">
          <div className="bg-purple-600/90 text-white p-3 rounded-full shadow-xl scale-100 group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 fill-current" />
          </div>
        </div>
        {/* Category Badge */}
        <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border backdrop-blur-sm ${getCategoryStyle(video.category || 'Other')}`}> 
          {getCategoryIcon(video.category || 'Other')}
          {video.category || 'Other'}
        </div>
        {/* Private Badge */}
        {video.playerId && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-purple-600 text-white">
            <Lock className="w-3 h-3" />
            Private
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-zinc-900 dark:text-white line-clamp-2">{video.title}</h3>
            {/* Player assignment (for private videos) */}
            {video.playerId && video.playerName && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-purple-500">
                <User className="w-3 h-3" />
                <span>For {video.playerName}</span>
              </div>
            )}
            {/* Visibility indicator */}
            {!video.playerId && (userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
              <div className="flex items-center gap-3 mt-2 text-xs">
                {video.isPublic ? (
                  <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-purple-500" />
                    <span className="text-purple-500">Public</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-zinc-500" />
                    <span className="text-zinc-500">Team Only</span>
                  </div>
                )}
                {/* Tagged athletes indicator */}
                {video.taggedPlayerIds && video.taggedPlayerIds.length > 0 && (
                  <div className="flex items-center gap-1 text-emerald-500">
                    <UserCheck className="w-3 h-3" />
                    <span>{video.taggedPlayerIds.length} tagged</span>
                  </div>
                )}
              </div>
            )}
            {/* Description preview */}
            {video.description && (
              <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{video.description}</p>
            )}
          </div>
          {/* Actions (Coach only) */}
          {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); openEditModal(video); }} 
                className="p-2 text-zinc-400 hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4"/>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setDeleteVideoConfirm({ id: video.id, title: video.title }); }} 
                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
import { Plus, Trash2, Play, Video as VideoIcon, X, AlertCircle, Film, Dumbbell, Trophy, FolderOpen, Edit2, Check, Lock, Users, Filter, User, Globe, UserCheck } from 'lucide-react';
import NoAthleteBlock from './NoAthleteBlock';

const VIDEO_CATEGORIES: { value: VideoCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'Game Film', label: 'Game Film', icon: <Film className="w-4 h-4" />, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
  { value: 'Practice', label: 'Practice', icon: <Users className="w-4 h-4" />, color: 'text-green-500 bg-green-500/10 border-green-500/20' },
  { value: 'Training', label: 'Training', icon: <Dumbbell className="w-4 h-4" />, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
  { value: 'Highlights', label: 'Highlights', icon: <Trophy className="w-4 h-4" />, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
  { value: 'Other', label: 'Other', icon: <FolderOpen className="w-4 h-4" />, color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' },
];

const VideoLibrary: React.FC = () => {
  const { userData, teamData, players, selectedPlayer } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [newVideo, setNewVideo] = useState<{
    title: string;
    url: string;
    category: VideoCategory;
    playerId: string;
    description: string;
    isPublic: boolean;
    taggedPlayerIds: string[];
  }>({ title: '', url: '', category: 'Game Film', playerId: '', description: '', isPublic: false, taggedPlayerIds: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tagAllPlayers, setTagAllPlayers] = useState(false);
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState<VideoCategory | 'All' | 'My Videos'>('All');
  
  // Track which video is playing (YouTube ID)
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  
  // Delete confirmation state
  const [deleteVideoConfirm, setDeleteVideoConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deletingVideo, setDeletingVideo] = useState(false);

  // Fetch videos
  useEffect(() => {
    if (!teamData?.id) return;
    const videosQuery = query(collection(db, 'teams', teamData.id, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
      const videoData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Video));
      setVideos(videoData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [teamData?.id]);

  // Fetch team players (for coaches to select when adding private videos)
  useEffect(() => {
    if (!teamData?.id || userData?.role === 'Parent') return;
    
    const fetchPlayers = async () => {
      const playersSnapshot = await getDocs(collection(db, 'teams', teamData.id, 'players'));
      const playersData = playersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Player));
      setTeamPlayers(playersData);
    };
    fetchPlayers();
  }, [teamData?.id, userData?.role]);

  // Filter videos based on user role and selected filter
  const filteredVideos = videos.filter(video => {
    // For Parents: Show team videos (no playerId) OR videos specifically for their player
    if (userData?.role === 'Parent') {
      const isTeamVideo = !video.playerId;
      const isMyPlayerVideo = video.playerId && players.some(p => p.id === video.playerId);
      
      if (!isTeamVideo && !isMyPlayerVideo) return false;
      
      // Apply category filter
      if (filterCategory === 'My Videos') {
        return isMyPlayerVideo;
      }
    }
    
    // Apply category filter
    if (filterCategory !== 'All' && filterCategory !== 'My Videos') {
      return video.category === filterCategory;
    }
    
    return true;
  });

  // Count videos by category for filter badges
  const getCategoryCount = (category: VideoCategory | 'All' | 'My Videos') => {
    if (category === 'All') {
      // For parents, only count visible videos
      if (userData?.role === 'Parent') {
        return videos.filter(v => !v.playerId || players.some(p => p.id === v.playerId)).length;
      }
      return videos.length;
    }
    if (category === 'My Videos') {
      return videos.filter(v => v.playerId && players.some(p => p.id === v.playerId)).length;
    }
    // For parents, only count visible videos in category
    if (userData?.role === 'Parent') {
      return videos.filter(v => v.category === category && (!v.playerId || players.some(p => p.id === v.playerId))).length;
    }
    return videos.filter(v => v.category === category).length;
  };

  // OPTIMIZED: Robust Regex that handles Standard, Share links, Embeds, AND Shorts
  const extractYoutubeId = (url: string) => {
    // Accept both standard and live YouTube links
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:live\/|watch\?v=|v\/|embed\/|shorts\/)?([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11}))/;
    const match = url.match(regExp);
    // If it's a live link, set isLive flag
    if (url.includes('/live/')) return { id: match?.[1] || match?.[2] || null, isLive: true };
    return { id: match?.[1] || match?.[2] || null, isLive: false };
  };

  const resetForm = () => {
    setNewVideo({ title: '', url: '', category: 'Game Film', playerId: '', description: '', isPublic: false, taggedPlayerIds: [] });
    setTagAllPlayers(false);
    setIsEditMode(false);
    setEditingVideo(null);
    setError('');
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (video: Video) => {
    setEditingVideo(video);
    const existingTags = video.taggedPlayerIds || [];
    // Check if all current players are tagged
    const allTagged = teamPlayers.length > 0 && teamPlayers.every(p => existingTags.includes(p.id));
    setTagAllPlayers(allTagged);
    setNewVideo({
      title: video.title,
      url: video.url,
      category: video.category || 'Other',
      playerId: video.playerId || '',
      description: video.description || '',
      isPublic: video.isPublic || false,
      taggedPlayerIds: existingTags
    });
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (saving) return;
    
    setError('');
    
    if (!teamData?.id || !newVideo.title || !newVideo.url) return;
    
    const { id: youtubeId, isLive } = extractYoutubeId(newVideo.url);
    if (!youtubeId) { 
      setError('Invalid URL. We support YouTube Videos, Shorts, and Live Streams.'); 
      return; 
    }

    setSaving(true);
    
    try {
      // Find player name if a player is selected
      let playerName = null;
      if (newVideo.playerId) {
        const player = teamPlayers.find(p => p.id === newVideo.playerId);
        playerName = player?.name || null;
      }

      // Determine which players to tag (only for Game Film and Highlights)
      const canTagPlayers = (newVideo.category === 'Game Film' || newVideo.category === 'Highlights') && !newVideo.playerId;
      const playerIdsToTag = canTagPlayers 
        ? (tagAllPlayers ? teamPlayers.map(p => p.id) : newVideo.taggedPlayerIds)
        : [];

      // Add the video
      const videoRef = await addDoc(collection(db, 'teams', teamData.id, 'videos'), {
        title: newVideo.title,
        url: newVideo.url,
        youtubeId,
        isLive,
        category: newVideo.category,
        playerId: newVideo.playerId || null,
        playerName: playerName,
        description: newVideo.description || null,
        taggedPlayerIds: playerIdsToTag,
        // Only allow public if NOT a private player video
        isPublic: newVideo.playerId ? false : newVideo.isPublic,
        createdAt: serverTimestamp(),
        createdBy: userData?.uid
      });

      // Save to tagged players' film room (for persistence on their public profiles)
      if (playerIdsToTag.length > 0) {
        console.log('Attempting to save film room for players:', playerIdsToTag);
        console.log('Team ID:', teamData.id);
        console.log('Video ID:', videoRef.id);
        
        try {
          const batch = writeBatch(db);
          for (const playerId of playerIdsToTag) {
            const filmPath = `teams/${teamData.id}/players/${playerId}/filmRoom/${videoRef.id}`;
            console.log('Writing to path:', filmPath);
            const filmEntryRef = doc(db, 'teams', teamData.id, 'players', playerId, 'filmRoom', videoRef.id);
            const filmEntry: Omit<PlayerFilmEntry, 'id'> = {
              videoId: videoRef.id,
              teamId: teamData.id,
              title: newVideo.title,
              youtubeId,
              category: newVideo.category,
              description: newVideo.description || '',
              taggedAt: serverTimestamp(),
              teamName: teamData.name
            };
            batch.set(filmEntryRef, filmEntry);
          }
          await batch.commit();
          console.log('SUCCESS: Saved film room entries for', playerIdsToTag.length, 'players');
        } catch (filmError) {
          console.error('Error saving to player film rooms:', filmError);
          // Video was saved, but film room entries failed - try individual writes as fallback
          for (const playerId of playerIdsToTag) {
            try {
              const filmEntryRef = doc(db, 'teams', teamData.id, 'players', playerId, 'filmRoom', videoRef.id);
              await setDoc(filmEntryRef, {
                videoId: videoRef.id,
                teamId: teamData.id,
                title: newVideo.title,
                youtubeId,
                category: newVideo.category,
                description: newVideo.description || null,
                taggedAt: serverTimestamp(),
                teamName: teamData.name
              });
              console.log('Fallback: saved film room entry for player', playerId);
            } catch (individualError) {
              console.error('Failed to save film room for player', playerId, individualError);
            }
          }
        }
      }
      
      resetForm();
      setIsModalOpen(false);
    } catch (error) { 
      console.error("Error adding video:", error);
      setError('Failed to save video. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (saving) return;
    
    setError('');
    
    if (!teamData?.id || !editingVideo || !newVideo.title) return;
    
    // If URL changed, re-extract YouTube ID
    let youtubeId = editingVideo.youtubeId;
    let isLive = editingVideo.isLive || false;
    if (newVideo.url !== editingVideo.url) {
      const { id: newYoutubeId, isLive: newIsLive } = extractYoutubeId(newVideo.url);
      if (!newYoutubeId) {
        setError('Invalid URL. We support YouTube Videos, Shorts, and Live Streams.');
        return;
      }
      youtubeId = newYoutubeId;
      isLive = newIsLive;
    }

    setSaving(true);
    
    try {
      // Find player name if a player is selected
      let playerName = null;
      if (newVideo.playerId) {
        const player = teamPlayers.find(p => p.id === newVideo.playerId);
        playerName = player?.name || null;
      }

      // Determine which players to tag (only for Game Film and Highlights)
      const canTagPlayers = (newVideo.category === 'Game Film' || newVideo.category === 'Highlights') && !newVideo.playerId;
      const playerIdsToTag = canTagPlayers 
        ? (tagAllPlayers ? teamPlayers.map(p => p.id) : newVideo.taggedPlayerIds)
        : [];

      // Get previously tagged players
      const previouslyTagged = editingVideo.taggedPlayerIds || [];
      
      // Find players to add, remove, and update
      const playersToAdd = playerIdsToTag.filter(id => !previouslyTagged.includes(id));
      const playersToRemove = previouslyTagged.filter(id => !playerIdsToTag.includes(id));
      const playersToUpdate = playerIdsToTag.filter(id => previouslyTagged.includes(id));

      // Update the video
      await updateDoc(doc(db, 'teams', teamData.id, 'videos', editingVideo.id), {
        title: newVideo.title,
        url: newVideo.url,
        youtubeId,
        isLive,
        category: newVideo.category,
        playerId: newVideo.playerId || null,
        playerName: playerName,
        description: newVideo.description || null,
        taggedPlayerIds: playerIdsToTag,
        // Only allow public if NOT a private player video
        isPublic: newVideo.playerId ? false : newVideo.isPublic,
      });

      // Update players' film rooms
      if (playersToAdd.length > 0 || playersToRemove.length > 0 || playersToUpdate.length > 0) {
        try {
          const batch = writeBatch(db);
          
          // Add to newly tagged players
          for (const playerId of playersToAdd) {
            const filmEntryRef = doc(db, 'teams', teamData.id, 'players', playerId, 'filmRoom', editingVideo.id);
            const filmEntry: Omit<PlayerFilmEntry, 'id'> = {
              videoId: editingVideo.id,
              teamId: teamData.id,
              title: newVideo.title,
              youtubeId,
              category: newVideo.category,
              description: newVideo.description || '',
              taggedAt: serverTimestamp(),
              teamName: teamData.name
            };
            batch.set(filmEntryRef, filmEntry);
          }
          
          // Remove from untagged players
          for (const playerId of playersToRemove) {
            const filmEntryRef = doc(db, 'teams', teamData.id, 'players', playerId, 'filmRoom', editingVideo.id);
            batch.delete(filmEntryRef);
          }
          
          // Update existing tagged players with new video info
          for (const playerId of playersToUpdate) {
            const filmEntryRef = doc(db, 'teams', teamData.id, 'players', playerId, 'filmRoom', editingVideo.id);
            // Use set with merge instead of update to handle case where doc doesn't exist
            batch.set(filmEntryRef, {
              videoId: editingVideo.id,
              teamId: teamData.id,
              title: newVideo.title,
              youtubeId,
              category: newVideo.category,
              description: newVideo.description || null,
              taggedAt: serverTimestamp(),
              teamName: teamData.name
            }, { merge: true });
          }
          
          await batch.commit();
          console.log('Successfully updated film room entries');
        } catch (filmError) {
          console.error('Error updating player film rooms:', filmError);
          // Try individual writes as fallback
          for (const playerId of playersToAdd) {
            try {
              await setDoc(doc(db, 'teams', teamData.id, 'players', playerId, 'filmRoom', editingVideo.id), {
                videoId: editingVideo.id,
                teamId: teamData.id,
                title: newVideo.title,
                youtubeId,
                category: newVideo.category,
                description: newVideo.description || null,
                taggedAt: serverTimestamp(),
                teamName: teamData.name
              });
            } catch (e) {
              console.error('Fallback failed for player', playerId, e);
            }
          }
        }
      }
      
      resetForm();
      setIsModalOpen(false);
    } catch (error) { 
      console.error("Error updating video:", error);
      setError('Failed to update video. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!teamData?.id || !deleteVideoConfirm) return;
    setDeletingVideo(true);
    try {
      // Delete the video from main collection only
      // NOTE: We intentionally DO NOT delete from players' film rooms
      // Tagged videos persist on player profiles for recruitment purposes even after coach deletes
      await deleteDoc(doc(db, 'teams', teamData.id, 'videos', deleteVideoConfirm.id));
      
      setDeleteVideoConfirm(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingVideo(false);
    }
  };


  return (
    <NoAthleteBlock featureName="Film Room">
      <div className="space-y-6 pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Film Room</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {userData?.role === 'Parent' 
              ? 'Watch game film, training videos, and personalized feedback'
              : 'Manage and share videos with your team'
            }
          </p>
        </div>
        {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
          <button 
            onClick={openAddModal} 
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20 font-medium"
          >
            <Plus className="w-5 h-5" /> Add Video
          </button>
        )}
      </div>

      {/* FILTER TABS */}
      <div className="flex flex-wrap gap-2">
        {/* All filter */}
        <button
          onClick={() => setFilterCategory('All')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            filterCategory === 'All'
              ? 'bg-purple-600 text-white border-purple-600 shadow-lg'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50'
          }`}
        >
          <Filter className="w-4 h-4" />
          All
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterCategory === 'All' ? 'bg-white/20' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
            {getCategoryCount('All')}
          </span>
        </button>

        {/* Category filters */}
        {VIDEO_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              filterCategory === cat.value
                ? `${cat.color} border-current shadow-lg`
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50'
            }`}
          >
            {cat.icon}
            <span className="hidden sm:inline">{cat.label}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterCategory === cat.value ? 'bg-current/20' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
              {getCategoryCount(cat.value)}
            </span>
          </button>
        ))}

        {/* My Videos filter (for parents) */}
        {userData?.role === 'Parent' && getCategoryCount('My Videos') > 0 && (
          <button
            onClick={() => setFilterCategory('My Videos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              filterCategory === 'My Videos'
                ? 'bg-purple-500/10 text-purple-500 border-purple-500/30 shadow-lg'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/50'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">For {selectedPlayer?.name || 'My Player'}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterCategory === 'My Videos' ? 'bg-purple-500/20' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
              {getCategoryCount('My Videos')}
            </span>
          </button>
        )}
      </div>

      {/* VIDEO GRID */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-purple-500"></div>
        </div>
      ) : filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map(video => (
            <VideoCard 
              video={video} 
              userData={userData} 
              openEditModal={openEditModal} 
              setDeleteVideoConfirm={setDeleteVideoConfirm} 
              setPlayingVideoId={setPlayingVideoId} 
              getCategoryStyle={getCategoryStyle}
              getCategoryIcon={getCategoryIcon}
              key={video.id} 
            />
          ))}
        </div>
      ) : (
        <EmptyState
          type="videos"
          title="Your Film Room is Empty"
          description={
            filterCategory === 'All' 
              ? 'Upload game film, highlight reels, and training videos. Tag players to build their personal film library.'
              : filterCategory === 'My Videos'
                ? 'No videos have been tagged for your player yet. Ask your coach to add some!'
                : `No ${filterCategory} videos yet. Add one to get started!`
          }
          actionLabel={(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') ? 'Add First Video' : undefined}
          onAction={(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') ? openAddModal : undefined}
        />
      )}

      {/* ADD/EDIT VIDEO MODAL */}
      )
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {isEditMode ? 'Edit Video' : 'Add New Video'}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {isEditMode ? 'Update video details' : 'Share a YouTube video with your team'}
                </p>
              </div>
              <button 
                onClick={() => { setIsModalOpen(false); resetForm(); }} 
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={isEditMode ? handleUpdateVideo : handleAddVideo} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm flex items-center gap-2 overflow-hidden">
                  <AlertCircle className="w-4 h-4 flex-shrink-0"/>
                  <span className="break-words overflow-hidden">{error}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Video Title *</label>
                <input 
                  value={newVideo.title} 
                  onChange={e => setNewVideo({...newVideo, title: e.target.value})} 
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-zinc-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none" 
                  placeholder="e.g. Week 3 Game Highlights" 
                  required 
                />
              </div>
              
              {/* URL */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">YouTube URL *</label>
                <input 
                  value={newVideo.url} 
                  onChange={e => setNewVideo({...newVideo, url: e.target.value})} 
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-zinc-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none" 
                  placeholder="https://youtube.com/watch?v=..." 
                  required 
                />
                <p className="text-[10px] text-zinc-500 mt-1">Supports YouTube Videos & Shorts</p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  {VIDEO_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setNewVideo({...newVideo, category: cat.value})}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        newVideo.category === cat.value
                          ? `${cat.color} border-current`
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {cat.icon}
                      <span className="font-medium text-sm">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Player Assignment (Private Video) */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Share Privately With Player (Optional)
                  </div>
                </label>
                <select
                  value={newVideo.playerId}
                  onChange={e => setNewVideo({...newVideo, playerId: e.target.value, isPublic: e.target.value ? false : newVideo.isPublic})}
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-zinc-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                >
                  <option value="">Visible to entire team</option>
                  {teamPlayers.map(player => (
                    <option key={player.id} value={player.id}>
                      {player.name} {player.number ? `#${player.number}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {newVideo.playerId 
                    ? '🔒 Only the selected player\'s parent will see this video'
                    : '👥 All team members will see this video'
                  }
                </p>
              </div>

              {/* Show on Public Page (only for team videos, not private) */}
              {!newVideo.playerId && (
                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-200 dark:border-purple-900/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newVideo.isPublic}
                      onChange={e => setNewVideo({...newVideo, isPublic: e.target.checked})}
                      className="w-5 h-5 rounded border-purple-300 dark:border-purple-700 text-purple-600 focus:ring-purple-500 bg-white dark:bg-zinc-900"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-400">
                        <Globe className="w-4 h-4" />
                        Show on Team's Public Page
                      </div>
                      <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                        Anyone with the team's public link can view this video
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Tag Athletes (only for Game Film & Highlights, and not private videos) */}
              {(newVideo.category === 'Game Film' || newVideo.category === 'Highlights') && !newVideo.playerId && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg border border-emerald-200 dark:border-emerald-900/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <UserCheck className="w-4 h-4" />
                      Tag Athletes for Recruitment
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tagAllPlayers}
                        onChange={e => {
                          setTagAllPlayers(e.target.checked);
                          if (e.target.checked) {
                            setNewVideo({...newVideo, taggedPlayerIds: teamPlayers.map(p => p.id)});
                          } else {
                            setNewVideo({...newVideo, taggedPlayerIds: []});
                          }
                        }}
                        className="w-4 h-4 rounded border-emerald-300 dark:border-emerald-700 text-emerald-600 focus:ring-emerald-500 bg-white dark:bg-zinc-900"
                      />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Tag All</span>
                    </label>
                  </div>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mb-3">
                    Tagged athletes will have this video on their public profile for recruitment visibility
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {teamPlayers.map(player => {
                      const isTagged = newVideo.taggedPlayerIds.includes(player.id);
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => {
                            if (isTagged) {
                              setNewVideo({...newVideo, taggedPlayerIds: newVideo.taggedPlayerIds.filter(id => id !== player.id)});
                              setTagAllPlayers(false);
                            } else {
                              const newTagged = [...newVideo.taggedPlayerIds, player.id];
                              setNewVideo({...newVideo, taggedPlayerIds: newTagged});
                              // Check if all players are now tagged
                              if (newTagged.length === teamPlayers.length) {
                                setTagAllPlayers(true);
                              }
                            }
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all ${
                            isTagged
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          <span className="truncate">{player.name}</span>
                          {player.number && <span className="text-[10px] opacity-70">#{player.number}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {newVideo.taggedPlayerIds.length > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                      {newVideo.taggedPlayerIds.length} athlete{newVideo.taggedPlayerIds.length !== 1 ? 's' : ''} tagged
                    </p>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Description (Optional)</label>
                <textarea 
                  value={newVideo.description} 
                  onChange={e => setNewVideo({...newVideo, description: e.target.value})} 
                  className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-zinc-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none" 
                  placeholder="Add notes, timestamps, or instructions..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-900">
                <button 
                  type="button" 
                  onClick={() => { setIsModalOpen(false); resetForm(); }} 
                  className="px-4 py-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-purple-900/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isEditMode ? 'Save Changes' : 'Add Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CINEMA MODE PLAYER (FULLSCREEN OVERLAY) */}
      {playingVideoId && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-300">
          <div className="w-full max-w-6xl relative aspect-video bg-black shadow-2xl rounded-lg overflow-hidden">
            {/* Close Button */}
            <button 
              onClick={() => setPlayingVideoId(null)} 
              className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-purple-600 p-2 rounded-full transition-colors backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* YouTube Embed */}
            <iframe 
              src={`https://www.youtube.com/embed/${playingVideoId}?autoplay=1&rel=0&modestbranding=1`} 
              title="YouTube video player" 
              className="w-full h-full"
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* DELETE VIDEO CONFIRMATION MODAL */}
      {deleteVideoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Video</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteVideoConfirm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <VideoIcon className="w-5 h-5 text-purple-500" />
                <p className="font-bold text-slate-900 dark:text-white line-clamp-2">{deleteVideoConfirm.title}</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Are you sure you want to delete this video from the Film Room? Team members will no longer be able to view it.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteVideoConfirm(null)}
                disabled={deletingVideo}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVideo}
                disabled={deletingVideo}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingVideo ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Video
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </NoAthleteBlock>
  );
};

export default VideoLibrary;
