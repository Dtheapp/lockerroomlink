
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
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Locker Room</h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-lg shadow-lg dark:shadow-xl">
          <h2 className="text-xl font-semibold text-sky-500 dark:text-sky-400 mb-2">Team Name</h2>
          <p className="text-3xl text-slate-900 dark:text-white font-bold">{teamData?.name || 'Loading...'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-lg shadow-lg dark:shadow-xl">
          <h2 className="text-xl font-semibold text-sky-500 dark:text-sky-400 mb-2">Team ID</h2>
          <div className="flex items-center space-x-4">
            <p className="text-lg md:text-2xl text-slate-900 dark:text-white font-mono bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded truncate border border-slate-200 dark:border-slate-700">{teamData?.id || 'Loading...'}</p>
            <button onClick={copyTeamId} className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-md">
              {isCopied ? <Check className="w-5 h-5 text-green-500 dark:text-green-400" /> : <Clipboard className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Share this ID with parents to have them join the team.</p>
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Bulletin Board</h2>
        {userData?.role === 'Coach' && (
          <form onSubmit={handleAddPost} className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg flex items-center gap-4 shadow-lg dark:shadow-xl">
            <input
              type="text"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Post an announcement..."
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
            />
            <button type="submit" className="p-2.5 rounded-md bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 transition-colors disabled:bg-slate-300 dark:disabled:bg-slate-700" disabled={!newPost.trim()}>
              <Plus className="w-5 h-5 text-white" />
            </button>
          </form>
        )}

        <div className="space-y-4">
          {loading ? (
            <p className="text-slate-600 dark:text-slate-400">Loading posts...</p>
          ) : posts.length > 0 ? (
            posts.map(post => (
              <div key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg shadow-lg dark:shadow-xl">
                <p className="text-slate-900 dark:text-slate-100">{post.text}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-right">
                  - {post.author} on {formatDate(post.timestamp)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-slate-600 dark:text-slate-400 text-center py-8">No announcements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
