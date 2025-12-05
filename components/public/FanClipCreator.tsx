import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Film, Play, Pause, SkipBack, SkipForward, Scissors, Clock, Send, X, ChevronLeft, ChevronRight, Search, Check, AlertCircle } from 'lucide-react';
import type { Video, Team, Player, FanClip } from '../../types';

interface FanClipCreatorProps {
  teamId: string;
  playerId: string;
  playerName: string;
  onClose: () => void;
  onClipCreated?: (clip: FanClip) => void;
}

interface VideoWithTeam extends Video {
  teamId: string;
  teamName: string;
}

const FanClipCreator: React.FC<FanClipCreatorProps> = ({
  teamId,
  playerId,
  playerName,
  onClose,
  onClipCreated
}) => {
  const { user, userData } = useAuth();
  
  // Video selection
  const [videos, setVideos] = useState<VideoWithTeam[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoWithTeam | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Clip editing
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  const [clipTitle, setClipTitle] = useState('');
  const [clipDescription, setClipDescription] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // YouTube player ref
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);

  // Load public videos from the athlete's team and other teams
  useEffect(() => {
    const loadVideos = async () => {
      setLoadingVideos(true);
      try {
        const allVideos: VideoWithTeam[] = [];
        
        // Get team info first
        const teamsSnap = await getDocs(collection(db, 'teams'));
        
        for (const teamDoc of teamsSnap.docs) {
          const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
          
          // Get public videos from this team
          const videosSnap = await getDocs(
            query(
              collection(db, 'teams', teamDoc.id, 'videos'),
              where('isPublic', '==', true)
            )
          );
          
          for (const videoDoc of videosSnap.docs) {
            const video = { id: videoDoc.id, ...videoDoc.data() } as Video;
            
            // Only include team videos (not private player videos)
            if (!video.playerId) {
              allVideos.push({
                ...video,
                teamId: teamDoc.id,
                teamName: team.name
              });
            }
          }
        }
        
        // Sort by most recent first
        allVideos.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        
        setVideos(allVideos);
      } catch (err) {
        console.error('Error loading videos:', err);
        setError('Failed to load videos');
      } finally {
        setLoadingVideos(false);
      }
    };

    loadVideos();
  }, []);

  // Initialize YouTube player when video is selected
  useEffect(() => {
    if (!selectedVideo || !playerContainerRef.current) return;

    // Load YouTube IFrame API if not already loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      (window as any).onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    } else {
      createPlayer();
    }

    function createPlayer() {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      
      playerRef.current = new (window as any).YT.Player(playerContainerRef.current, {
        videoId: selectedVideo.youtubeId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          start: 0
        },
        events: {
          onReady: (event: any) => {
            const dur = event.target.getDuration();
            setDuration(dur);
            setEndTime(Math.min(30, dur));
          },
          onStateChange: (event: any) => {
            setIsPlaying(event.data === 1);
          }
        }
      });
    }

    // Update current time periodically
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [selectedVideo]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (time: number) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
  };

  const handleSetStart = () => {
    const time = Math.floor(currentTime);
    setStartTime(time);
    if (time >= endTime) {
      setEndTime(Math.min(time + 30, duration));
    }
  };

  const handleSetEnd = () => {
    const time = Math.floor(currentTime);
    setEndTime(time);
    if (time <= startTime) {
      setStartTime(Math.max(0, time - 30));
    }
  };

  // Timeline click handler - click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !playerRef.current || duration === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    handleSeek(newTime);
  };

  // Get time from mouse position
  const getTimeFromMouseEvent = (e: MouseEvent | React.MouseEvent): number => {
    if (!timelineRef.current || duration === 0) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  };

  // Start dragging a marker
  const handleMarkerMouseDown = (marker: 'start' | 'end') => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(marker);
  };

  // Handle mouse move while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = Math.floor(getTimeFromMouseEvent(e));
      
      if (isDragging === 'start') {
        // Don't let start go past end - 3 seconds
        const maxStart = Math.max(0, endTime - 3);
        setStartTime(Math.min(time, maxStart));
      } else if (isDragging === 'end') {
        // Don't let end go before start + 3 seconds
        const minEnd = Math.min(duration, startTime + 3);
        setEndTime(Math.max(time, minEnd));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startTime, endTime, duration]);

  const handlePreviewClip = () => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(startTime, true);
    playerRef.current.playVideo();
    
    // Auto-pause at end time
    const checkEnd = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const curr = playerRef.current.getCurrentTime();
        if (curr >= endTime) {
          playerRef.current.pauseVideo();
          clearInterval(checkEnd);
        }
      }
    }, 200);
    
    setTimeout(() => clearInterval(checkEnd), (endTime - startTime + 5) * 1000);
  };

  const handleSubmitClip = async () => {
    if (!user || !userData || !selectedVideo) return;
    
    if (!clipTitle.trim()) {
      setError('Please enter a title for your clip');
      return;
    }
    
    const clipDuration = endTime - startTime;
    if (clipDuration < 3) {
      setError('Clip must be at least 3 seconds long');
      return;
    }
    if (clipDuration > 60) {
      setError('Clip cannot be longer than 60 seconds');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const clipData: Omit<FanClip, 'id'> = {
        sourceVideoId: selectedVideo.id,
        sourceVideoTitle: selectedVideo.title,
        sourceTeamId: selectedVideo.teamId,
        sourceTeamName: selectedVideo.teamName,
        youtubeId: selectedVideo.youtubeId,
        startTime,
        endTime,
        title: clipTitle.trim(),
        description: clipDescription.trim() || undefined,
        creatorId: user.uid,
        creatorName: userData.name || 'Anonymous Fan',
        creatorUsername: userData.username || undefined,
        athleteId: playerId,
        athleteName: playerName,
        createdAt: serverTimestamp(),
        likes: [],
        likeCount: 0,
        viewCount: 0,
        isApproved: false, // Needs parent approval
      };
      
      const docRef = await addDoc(
        collection(db, 'teams', teamId, 'players', playerId, 'fanClips'),
        clipData
      );
      
      const newClip: FanClip = {
        id: docRef.id,
        ...clipData,
        createdAt: new Date(),
      };
      
      setSubmitSuccess(true);
      
      if (onClipCreated) {
        onClipCreated(newClip);
      }
      
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Error creating clip:', err);
      setError('Failed to create clip. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter videos by search
  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.teamName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Scissors className="text-purple-400" size={24} />
            <div>
              <h2 className="text-lg font-bold text-white">Create Highlight Clip</h2>
              <p className="text-sm text-zinc-400">For {playerName}'s profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {submitSuccess ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="text-green-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Clip Created!</h3>
              <p className="text-zinc-400">
                Your clip has been submitted for review. The athlete's parent will approve it before it appears on their profile.
              </p>
            </div>
          ) : !selectedVideo ? (
            // Video Selection
            <div>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search videos..."
                    className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500"
                  />
                </div>
              </div>

              {loadingVideos ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="text-center py-12">
                  <Film className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">No public videos available</p>
                  <p className="text-zinc-500 text-sm mt-1">Videos marked as public by teams will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredVideos.map((video) => (
                    <button
                      key={`${video.teamId}_${video.id}`}
                      onClick={() => setSelectedVideo(video)}
                      className="bg-zinc-800/50 rounded-lg overflow-hidden text-left hover:bg-zinc-800 transition-colors border border-zinc-700 hover:border-purple-500/50"
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-video bg-zinc-900">
                        <img
                          src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                          <Play className="text-white" size={40} />
                        </div>
                        <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded">
                          {video.category}
                        </span>
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <h4 className="font-medium text-white truncate">{video.title}</h4>
                        <p className="text-sm text-zinc-400 truncate">{video.teamName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Clip Editor
            <div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
              >
                <ChevronLeft size={16} />
                Choose Different Video
              </button>

              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <div ref={playerContainerRef} className="w-full h-full" />
              </div>

              {/* Timeline */}
              <div className="bg-zinc-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Timeline <span className="text-zinc-500">(click to seek, drag markers to adjust)</span></span>
                  <span className="text-sm text-zinc-400">
                    Clip: {formatTime(endTime - startTime)}
                  </span>
                </div>
                
                {/* Timeline bar - clickable */}
                <div 
                  ref={timelineRef}
                  onClick={handleTimelineClick}
                  className="relative h-12 bg-zinc-700 rounded-lg mb-3 cursor-pointer select-none"
                >
                  {/* Unselected area (darker) */}
                  <div className="absolute inset-0 bg-zinc-800/50 rounded-lg" />
                  
                  {/* Selected range (highlighted) */}
                  <div
                    className="absolute h-full bg-purple-500/40 border-y-2 border-purple-500"
                    style={{
                      left: `${(startTime / duration) * 100}%`,
                      width: `${((endTime - startTime) / duration) * 100}%`
                    }}
                  />
                  
                  {/* Current position indicator */}
                  <div
                    className="absolute w-0.5 h-full bg-white shadow-lg z-10"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow" />
                  </div>
                  
                  {/* Start marker - draggable */}
                  <div
                    onMouseDown={handleMarkerMouseDown('start')}
                    className={`absolute w-4 h-full bg-green-500 rounded-l-lg cursor-ew-resize z-20 flex items-center justify-center hover:bg-green-400 transition-colors ${isDragging === 'start' ? 'bg-green-400 ring-2 ring-green-300' : ''}`}
                    style={{ left: `calc(${(startTime / duration) * 100}% - 8px)` }}
                    title={`Start: ${formatTime(startTime)} - Drag to adjust`}
                  >
                    <div className="w-0.5 h-6 bg-green-800 rounded" />
                  </div>
                  
                  {/* End marker - draggable */}
                  <div
                    onMouseDown={handleMarkerMouseDown('end')}
                    className={`absolute w-4 h-full bg-red-500 rounded-r-lg cursor-ew-resize z-20 flex items-center justify-center hover:bg-red-400 transition-colors ${isDragging === 'end' ? 'bg-red-400 ring-2 ring-red-300' : ''}`}
                    style={{ left: `calc(${(endTime / duration) * 100}% - 8px)` }}
                    title={`End: ${formatTime(endTime)} - Drag to adjust`}
                  >
                    <div className="w-0.5 h-6 bg-red-800 rounded" />
                  </div>
                  
                  {/* Time markers */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-zinc-500">
                    <span>0:00</span>
                    <span>{formatTime(duration / 4)}</span>
                    <span>{formatTime(duration / 2)}</span>
                    <span>{formatTime(duration * 3 / 4)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSeek(Math.max(0, currentTime - 5))}
                      className="p-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 text-white"
                    >
                      <SkipBack size={16} />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className="p-2 bg-purple-600 rounded-lg hover:bg-purple-500 text-white"
                    >
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      onClick={() => handleSeek(Math.min(duration, currentTime + 5))}
                      className="p-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 text-white"
                    >
                      <SkipForward size={16} />
                    </button>
                    <span className="text-sm text-zinc-400 ml-2">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSetStart}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg flex items-center gap-1"
                    >
                      Set Start
                    </button>
                    <button
                      onClick={handleSetEnd}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg flex items-center gap-1"
                    >
                      Set End
                    </button>
                    <button
                      onClick={handlePreviewClip}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg flex items-center gap-1"
                    >
                      <Play size={14} />
                      Preview
                    </button>
                  </div>
                </div>

                {/* Time inputs */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Start:</span>
                    <span className="text-sm text-green-400 font-mono">{formatTime(startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">End:</span>
                    <span className="text-sm text-red-400 font-mono">{formatTime(endTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-zinc-500" />
                    <span className="text-sm text-zinc-300">
                      Duration: {formatTime(endTime - startTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clip Details */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Clip Title *</label>
                  <input
                    type="text"
                    value={clipTitle}
                    onChange={(e) => setClipTitle(e.target.value.slice(0, 100))}
                    placeholder={`${playerName}'s amazing play!`}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500"
                  />
                  <p className="text-xs text-zinc-500 text-right mt-1">{clipTitle.length}/100</p>
                </div>
                
                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Description (optional)</label>
                  <textarea
                    value={clipDescription}
                    onChange={(e) => setClipDescription(e.target.value.slice(0, 500))}
                    placeholder="Describe what's happening in this clip..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 resize-none"
                    rows={2}
                  />
                  <p className="text-xs text-zinc-500 text-right mt-1">{clipDescription.length}/500</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="bg-zinc-800/50 rounded-lg p-3 text-sm">
                  <p className="text-zinc-400">
                    <strong className="text-zinc-300">Note:</strong> Your clip will be submitted for review. 
                    The athlete's parent must approve it before it appears on their public profile.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedVideo && !submitSuccess && (
          <div className="p-4 border-t border-zinc-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitClip}
              disabled={submitting || !clipTitle.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit Clip
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FanClipCreator;
