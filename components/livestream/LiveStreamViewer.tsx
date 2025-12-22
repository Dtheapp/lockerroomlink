import React, { useState, useEffect } from 'react';
import { X, Radio, Video, Users, Grid, Maximize2, Minimize2, Square, StopCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { LiveStream } from '../../types';

interface LiveStreamViewerProps {
  streams: LiveStream[];
  teamId: string;
  teamName: string;
  onClose: () => void;
  isCoach?: boolean;
  onStreamEnded?: (stream: LiveStream) => void;
  embedded?: boolean; // If true, shows minimal UI for inline embedding
}

const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ 
  streams, 
  teamId, 
  teamName, 
  onClose,
  isCoach = false,
  onStreamEnded,
  embedded = false
}) => {
  const { user } = useAuth();
  const [selectedStreamIndex, setSelectedStreamIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [endingStream, setEndingStream] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState<string | null>(null);

  const selectedStream = streams[selectedStreamIndex];

  // Handle ending a stream
  const handleEndStream = async (streamId: string) => {
    const stream = streams.find(s => s.id === streamId);
    setEndingStream(streamId);
    try {
      await updateDoc(doc(db, 'teams', teamId, 'liveStreams', streamId), {
        isLive: false,
        endedAt: serverTimestamp(),
      });
      setShowEndConfirm(null);
      
      // Trigger the callback so parent can show save dialog
      if (stream && onStreamEnded) {
        onStreamEnded(stream);
      }
      
      // If this was the only stream or the selected stream, close modal
      if (streams.length === 1) {
        onClose();
      } else if (streams[selectedStreamIndex].id === streamId) {
        setSelectedStreamIndex(0);
      }
    } catch (err) {
      console.error('Error ending stream:', err);
    } finally {
      setEndingStream(null);
    }
  };

  // Check if current user owns a stream
  const userOwnsStream = (stream: LiveStream) => {
    return user?.uid === stream.coachId;
  };

  // Render YouTube embed
  const renderYouTubeEmbed = (stream: LiveStream, size: 'full' | 'grid' = 'full') => {
    const embedUrl = `https://www.youtube.com/embed/${stream.youtubeVideoId}?autoplay=1&rel=0`;
    
    return (
      <div className={`relative ${size === 'full' ? 'w-full h-full' : 'w-full aspect-video'}`}>
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={stream.title}
        />
        {/* Stream info overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
            <Radio className="w-3 h-3 animate-pulse" /> LIVE
          </span>
          <span className="bg-black/70 text-white text-xs px-2 py-1 rounded">
            {stream.cameraAngle}
          </span>
        </div>
        {/* Coach end stream button */}
        {userOwnsStream(stream) && isCoach && (
          <button
            onClick={() => setShowEndConfirm(stream.id)}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
          >
            <StopCircle className="w-4 h-4" /> End Stream
          </button>
        )}
      </div>
    );
  };

  // Embedded mode - just render the video content inline
  if (embedded) {
    if (!selectedStream) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-xl">
          <div className="text-center text-zinc-400">
            <Radio className="w-8 h-8 mx-auto mb-2 animate-pulse text-red-500" />
            <p>Loading stream...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="w-full h-full">
        {renderYouTubeEmbed(selectedStream, 'full')}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              🔴 LIVE: {teamName}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-zinc-400 text-sm">
                {streams.length} stream{streams.length !== 1 ? 's' : ''} active
              </p>
              {/* Prominent multi-stream button */}
              {streams.length > 1 && viewMode === 'single' && (
                <button
                  onClick={() => setViewMode('grid')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 transition-all animate-pulse hover:animate-none"
                >
                  <Grid className="w-3.5 h-3.5" />
                  Watch All {streams.length} Streams
                </button>
              )}
              {streams.length > 1 && viewMode === 'grid' && (
                <button
                  onClick={() => setViewMode('single')}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Single View
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Stream tabs (only if multiple streams and single view) */}
      {streams.length > 1 && viewMode === 'single' && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex gap-2 overflow-x-auto shrink-0">
          {streams.map((stream, index) => (
            <button
              key={stream.id}
              onClick={() => setSelectedStreamIndex(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                selectedStreamIndex === index
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <Video className="w-4 h-4" />
              {stream.cameraAngle}
              <span className="text-xs opacity-70">- {stream.coachName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Video content */}
      <div className="flex-1 bg-black overflow-hidden">
        {viewMode === 'single' ? (
          // Single stream view
          <div className="w-full h-full">
            {selectedStream && renderYouTubeEmbed(selectedStream, 'full')}
          </div>
        ) : (
          // Grid view
          <div className={`w-full h-full grid gap-1 p-1 ${
            streams.length === 2 ? 'grid-cols-2' : 
            streams.length <= 4 ? 'grid-cols-2 grid-rows-2' : 
            'grid-cols-3 grid-rows-2'
          }`}>
            {streams.map((stream) => (
              <div key={stream.id} className="relative bg-zinc-900 rounded overflow-hidden">
                {renderYouTubeEmbed(stream, 'grid')}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stream info bar */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">{selectedStream?.title}</h3>
            <p className="text-zinc-400 text-sm">
              Streaming by {selectedStream?.coachName} • {selectedStream?.cameraAngle}
            </p>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Users className="w-4 h-4" />
            <span className="text-sm">DVR enabled - Use YouTube controls to rewind</span>
          </div>
        </div>
      </div>

      {/* End stream confirmation modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full border border-zinc-700">
            <h3 className="text-xl font-bold text-white mb-2">End Live Stream?</h3>
            <p className="text-zinc-400 mb-6">
              This will end the live stream for all viewers. You can optionally save it to your team's video library.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(null)}
                className="flex-1 px-4 py-3 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEndStream(showEndConfirm)}
                disabled={endingStream === showEndConfirm}
                className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {endingStream === showEndConfirm ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Ending...
                  </>
                ) : (
                  <>
                    <StopCircle className="w-5 h-5" />
                    End Stream
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveStreamViewer;
