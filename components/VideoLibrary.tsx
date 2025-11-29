
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Video } from '../types';
import { Plus, Trash2 } from 'lucide-react';

const getYoutubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const VideoLibrary: React.FC = () => {
  const { userData, teamData } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: '', url: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamData?.id) return;
    setLoading(true);
    const videosCollection = collection(db, 'teams', teamData.id, 'videos');
    const q = query(videosCollection, orderBy('title'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
      setVideos(videosData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching videos:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamData?.id) return;
    
    const youtubeId = getYoutubeId(newVideo.url);
    if (!youtubeId) {
      setError('Invalid YouTube URL.');
      return;
    }
    setError('');

    try {
      await addDoc(collection(db, 'teams', teamData.id, 'videos'), {
        title: newVideo.title,
        url: newVideo.url,
        youtubeId: youtubeId,
      });
      setNewVideo({ title: '', url: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding video:", error);
    }
  };
  
  const handleDeleteVideo = async (videoId: string) => {
    if (!teamData?.id || !window.confirm("Delete this video?")) return;
    try {
      await deleteDoc(doc(db, 'teams', teamData.id, 'videos', videoId));
    } catch (error) {
      console.error("Error deleting video:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewVideo(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Film Room</h1>
        {userData?.role === 'Coach' && (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-5 h-5" />
            Add Video
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Loading videos...</p>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map(video => (
            <div key={video.id} className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl">
              <div className="aspect-w-16 aspect-h-9">
                <iframe
                  src={`https://www.youtube.com/embed/${video.youtubeId}`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
              <div className="p-4 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{video.title}</h3>
                {userData?.role === 'Coach' && (
                  <button onClick={() => handleDeleteVideo(video.id)} className="p-1.5 rounded-full text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-600 dark:text-slate-400 text-center py-8">No videos in the library yet.</p>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Add New Video</h2>
            <form onSubmit={handleAddVideo} className="space-y-4">
              {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
              <input name="title" value={newVideo.title} onChange={handleInputChange} placeholder="Video Title" className="w-full bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white" required />
              <input name="url" value={newVideo.url} onChange={handleInputChange} placeholder="YouTube URL" className="w-full bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white" required />
              <div className="flex justify-end gap-4 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-900 dark:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white transition-colors">Add Video</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibrary;
