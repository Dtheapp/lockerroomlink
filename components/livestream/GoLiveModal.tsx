import React, { useState } from 'react';
import { X, Video, Radio, Eye, EyeOff, Link, AlertCircle, Check } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { CameraAngle } from '../../types';

interface GoLiveModalProps {
  onClose: () => void;
  teamId: string;
  teamName: string;
}

const CAMERA_ANGLES: CameraAngle[] = ['Sideline', 'End Zone', 'Press Box', 'Drone', 'Other'];

const GoLiveModal: React.FC<GoLiveModalProps> = ({ onClose, teamId, teamName }) => {
  const { user, userData } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [cameraAngle, setCameraAngle] = useState<CameraAngle | string>('Sideline');
  const [customAngle, setCustomAngle] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'team'>('public');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const validateUrl = (url: string): boolean => {
    return extractYouTubeId(url) !== null;
  };

  const handleGoLive = async () => {
    if (!user || !userData) return;
    
    // Validation
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }
    
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      setError('Invalid YouTube URL. Please enter a valid YouTube video or live stream URL.');
      return;
    }
    
    if (!title.trim()) {
      setError('Please enter a title for the stream');
      return;
    }

    const finalAngle = cameraAngle === 'Other' ? customAngle || 'Other' : cameraAngle;

    setSaving(true);
    setError('');

    try {
      await addDoc(collection(db, 'teams', teamId, 'liveStreams'), {
        youtubeUrl: youtubeUrl.trim(),
        youtubeVideoId: videoId,
        teamId,
        coachId: user.uid,
        coachName: userData.name || 'Coach',
        title: title.trim(),
        cameraAngle: finalAngle,
        visibility,
        isLive: true,
        startedAt: serverTimestamp(),
        endedAt: null,
        savedToLibrary: false,
      });

      onClose();
    } catch (err) {
      console.error('Error starting live stream:', err);
      setError('Failed to start live stream. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isValidUrl = youtubeUrl ? validateUrl(youtubeUrl) : true;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Go Live</h2>
              <p className="text-red-100 text-sm">{teamName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">How to Go Live:</h3>
            <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
              <li>Start a live stream on YouTube (mobile app or studio)</li>
              <li>Copy the stream URL from YouTube</li>
              <li>Paste it below and click "Go Live"</li>
            </ol>
          </div>

          {/* YouTube URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Link className="w-4 h-4 inline mr-1" />
              YouTube Stream URL *
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/live/... or https://youtu.be/..."
              className={`w-full px-4 py-3 rounded-lg border ${
                youtubeUrl && !isValidUrl 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                  : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800'
              } text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent`}
            />
            {youtubeUrl && !isValidUrl && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Invalid YouTube URL
              </p>
            )}
            {youtubeUrl && isValidUrl && (
              <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                <Check className="w-4 h-4" /> Valid YouTube URL
              </p>
            )}
          </div>

          {/* Stream Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Stream Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Wildcats vs Eagles - Week 5"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Camera Angle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Video className="w-4 h-4 inline mr-1" />
              Camera Angle
            </label>
            <div className="flex flex-wrap gap-2">
              {CAMERA_ANGLES.map((angle) => (
                <button
                  key={angle}
                  onClick={() => setCameraAngle(angle)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    cameraAngle === angle
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {angle}
                </button>
              ))}
            </div>
            {cameraAngle === 'Other' && (
              <input
                type="text"
                value={customAngle}
                onChange={(e) => setCustomAngle(e.target.value)}
                placeholder="Enter custom angle name"
                className="w-full mt-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-sm"
              />
            )}
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Who can view?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setVisibility('public')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  visibility === 'public'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                }`}
              >
                <Eye className={`w-6 h-6 mx-auto mb-2 ${visibility === 'public' ? 'text-red-500' : 'text-slate-400'}`} />
                <p className={`font-medium ${visibility === 'public' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>Public</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Anyone can view</p>
              </button>
              <button
                onClick={() => setVisibility('team')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  visibility === 'team'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                }`}
              >
                <EyeOff className={`w-6 h-6 mx-auto mb-2 ${visibility === 'team' ? 'text-red-500' : 'text-slate-400'}`} />
                <p className={`font-medium ${visibility === 'team' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>Team Only</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Only team members</p>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGoLive}
            disabled={saving || !isValidUrl || !youtubeUrl || !title}
            className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Radio className="w-5 h-5" />
                Go Live
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoLiveModal;
