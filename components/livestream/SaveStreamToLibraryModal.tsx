import React, { useState } from 'react';
import { X, Save, Video, Calendar, Tag, FileText, ExternalLink } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { LiveStream } from '../../types';

interface SaveStreamToLibraryModalProps {
  stream: LiveStream;
  teamId: string;
  onClose: () => void;
  onSaved?: () => void;
}

const SaveStreamToLibraryModal: React.FC<SaveStreamToLibraryModalProps> = ({
  stream,
  teamId,
  onClose,
  onSaved
}) => {
  const [title, setTitle] = useState(stream.title);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Game Film');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    'Game Film',
    'Practice',
    'Highlights',
    'Training',
    'Analysis',
    'Other'
  ];

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create video in the team's videos collection
      const videoRef = await addDoc(collection(db, 'teams', teamId, 'videos'), {
        title: title.trim(),
        description: description.trim(),
        category,
        tags,
        youtubeUrl: stream.youtubeUrl,
        youtubeVideoId: stream.youtubeVideoId,
        uploadedBy: stream.coachId,
        uploadedByName: stream.coachName,
        fromLiveStream: true,
        liveStreamId: stream.id,
        cameraAngle: stream.cameraAngle,
        streamedAt: stream.startedAt,
        createdAt: serverTimestamp(),
        visibility: stream.visibility,
      });

      // Update the stream to mark as saved
      await updateDoc(doc(db, 'teams', teamId, 'liveStreams', stream.id), {
        savedToLibrary: true,
        libraryVideoId: videoRef.id,
      });

      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Error saving to library:', err);
      setError('Failed to save video. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-zinc-700">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between sticky top-0 bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Save className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Save to Video Library</h2>
              <p className="text-zinc-400 text-sm">Add this stream to your team's film room</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* YouTube preview */}
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <div className="flex items-start gap-3">
              <div className="bg-red-600 p-2 rounded-lg shrink-0">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{stream.title}</p>
                <p className="text-zinc-400 text-sm">
                  {stream.cameraAngle} • Streamed by {stream.coachName}
                </p>
                <a 
                  href={stream.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 text-sm flex items-center gap-1 hover:text-red-300 mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on YouTube
                </a>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Video Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
              placeholder="Enter video title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 resize-none"
              placeholder="Add notes about this video..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === cat
                      ? 'bg-green-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-2">
              <Tag className="w-4 h-4 inline mr-1" />
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                placeholder="Add tags..."
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-zinc-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 flex gap-3 sticky bottom-0 bg-zinc-900">
          <button
            onClick={handleDiscard}
            className="flex-1 px-4 py-3 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
          >
            Don't Save
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save to Library
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveStreamToLibraryModal;
