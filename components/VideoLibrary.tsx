import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Video } from '../types';
import { Plus, Trash2, Play, Video as VideoIcon, X } from 'lucide-react';

const VideoLibrary: React.FC = () => {
  const { userData, teamData } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: '', url: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamData?.id) return;
    const q = query(collection(db, 'teams', teamData.id, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
      setVideos(videoData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [teamData?.id]);

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamData?.id || !newVideo.title || !newVideo.url) return;
    const youtubeId = extractYoutubeId(newVideo.url);
    if (!youtubeId) { alert('Please enter a valid YouTube URL'); return; }

    try {
      await addDoc(collection(db, 'teams', teamData.id, 'videos'), {
        title: newVideo.title, url: newVideo.url, youtubeId, createdAt: serverTimestamp()
      });
      setNewVideo({ title: '', url: '' }); setIsModalOpen(false);
    } catch (error) { console.error("Error adding video:", error); }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!teamData?.id || !window.confirm("Delete this video?")) return;
    await deleteDoc(doc(db, 'teams', teamData.id, 'videos', id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Film Room</h1>
        {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-500 transition-colors shadow-lg shadow-orange-900/20">
            <Plus className="w-5 h-5" /> Add Video
          </button>
        )}
      </div>

      {loading ? <p className="text-zinc-500">Loading videos...</p> : videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map(video => (
            <div key={video.id} className="bg-slate-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-lg hover:border-orange-500/30 transition-colors group">
              <div className="relative aspect-video bg-black">
                <img src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"/>
                <a href={video.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-colors">
                  <div className="bg-orange-600/90 text-white p-3 rounded-full shadow-xl scale-100 group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                </a>
              </div>
              <div className="p-4 flex justify-between items-start">
                <div className="flex items-start gap-2">
                    <VideoIcon className="w-4 h-4 text-zinc-500 mt-1" />
                    <h3 className="font-bold text-zinc-900 dark:text-white line-clamp-2">{video.title}</h3>
                </div>
                {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                  <button onClick={() => handleDeleteVideo(video.id)} className="text-zinc-600 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800">
            <VideoIcon className="w-12 h-12 mx-auto text-zinc-600 mb-3 opacity-50" />
            <p className="text-zinc-500">No videos in the library yet.</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-50 dark:bg-zinc-950 w-full max-w-md rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Add New Video</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddVideo} className="space-y-4">
              <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Video Title</label>
                  <input value={newVideo.title} onChange={e => setNewVideo({...newVideo, title: e.target.value})} className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded p-3 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" placeholder="e.g. Game Highlights vs Tigers" required />
              </div>
              <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">YouTube URL</label>
                  <input value={newVideo.url} onChange={e => setNewVideo({...newVideo, url: e.target.value})} className="w-full bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded p-3 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" placeholder="https://youtube.com/watch?v=..." required />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-900">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">Cancel</button>
                <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-orange-900/20">Add Video</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoLibrary;