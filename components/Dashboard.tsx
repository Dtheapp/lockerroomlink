
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Clipboard, Check, Plus } from 'lucide-react';
import type { BulletinPost } from '../types';

const Dashboard: React.FC = () => {
  const { userData, teamData } = useAuth();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!teamData?.id) return;
    setLoading(true);
    const postsCollection = collection(db, 'teams', teamData.id, 'bulletin');
    const q = query(postsCollection, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BulletinPost));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !teamData?.id || !userData?.name) return;

    try {
      await addDoc(collection(db, 'teams', teamData.id, 'bulletin'), {
        text: newPost,
        author: userData.name,
        timestamp: serverTimestamp(),
      });
      setNewPost('');
    } catch (error) {
      console.error("Error adding post:", error);
    }
  };

  const copyTeamId = () => {
    if (teamData?.id) {
      navigator.clipboard.writeText(teamData.id);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
  
  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp.seconds * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Locker Room</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-sky-400 mb-2">Team Name</h2>
          <p className="text-3xl text-white font-bold">{teamData?.name || 'Loading...'}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-sky-400 mb-2">Team ID</h2>
          <div className="flex items-center space-x-4">
            <p className="text-lg md:text-2xl text-white font-mono bg-slate-800 px-3 py-1 rounded truncate">{teamData?.id || 'Loading...'}</p>
            <button onClick={copyTeamId} className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors">
              {isCopied ? <Check className="w-5 h-5 text-green-400" /> : <Clipboard className="w-5 h-5 text-slate-300" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Share this ID with parents to have them join the team.</p>
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Bulletin Board</h2>
        {userData?.role === 'Coach' && (
          <form onSubmit={handleAddPost} className="mb-6 bg-slate-900 p-4 rounded-lg flex items-center gap-4">
            <input
              type="text"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Post an announcement..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500"
            />
            <button type="submit" className="p-2.5 rounded-md bg-sky-600 hover:bg-sky-700 transition-colors disabled:bg-slate-600" disabled={!newPost.trim()}>
              <Plus className="w-5 h-5 text-white" />
            </button>
          </form>
        )}

        <div className="space-y-4">
          {loading ? (
            <p className="text-slate-400">Loading posts...</p>
          ) : posts.length > 0 ? (
            posts.map(post => (
              <div key={post.id} className="bg-slate-900 p-4 rounded-lg">
                <p className="text-slate-100">{post.text}</p>
                <p className="text-xs text-slate-400 mt-2 text-right">
                  - {post.author} on {formatDate(post.timestamp)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-slate-400 text-center py-8">No announcements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
