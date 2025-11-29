
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Clipboard, Check, Plus, TrendingUp, Edit2, Trash2, MapPin, Calendar } from 'lucide-react';
import type { BulletinPost, PlayerStats, TeamEvent } from '../types';

const Dashboard: React.FC = () => {
  const { userData, teamData } = useAuth();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<TeamEvent>>({});
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<TeamEvent>>({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    type: 'Practice',
  });

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

  useEffect(() => {
    if (!teamData?.id) return;
    setStatsLoading(true);
    const statsCollection = collection(db, 'teams', teamData.id, 'playerStats');
    const q = query(statsCollection, orderBy('tds', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const statsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats));
      setPlayerStats(statsData);
      setStatsLoading(false);
    }, (error) => {
      console.error("Error fetching stats:", error);
      setStatsLoading(false);
    });

    return () => unsubscribe();
  }, [teamData?.id]);

  useEffect(() => {
    if (!teamData?.id) return;
    setEventsLoading(true);
    const eventsCollection = collection(db, 'teams', teamData.id, 'events');
    const q = query(eventsCollection, orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamEvent));
      setTeamEvents(eventsData);
      setEventsLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setEventsLoading(false);
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
        authorId: userData.uid,
        timestamp: serverTimestamp(),
      });
      setNewPost('');
    } catch (error) {
      console.error("Error adding post:", error);
    }
  };

  const handleEditPost = async (postId: string) => {
    if (!editingPostText.trim() || !teamData?.id) return;

    try {
      await updateDoc(doc(db, 'teams', teamData.id, 'bulletin', postId), {
        text: editingPostText,
      });
      setEditingPostId(null);
      setEditingPostText('');
    } catch (error) {
      console.error("Error updating post:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!teamData?.id) return;

    try {
      await deleteDoc(doc(db, 'teams', teamData.id, 'bulletin', postId));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleEditEvent = async (eventId: string) => {
    if (!teamData?.id || !editingEvent.title?.trim()) return;

    try {
      await updateDoc(doc(db, 'teams', teamData.id, 'events', eventId), {
        title: editingEvent.title,
        date: editingEvent.date,
        time: editingEvent.time,
        location: editingEvent.location,
        description: editingEvent.description,
        type: editingEvent.type,
      });
      setEditingEventId(null);
      setEditingEvent({});
    } catch (error) {
      console.error("Error updating event:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!teamData?.id) return;

    try {
      await deleteDoc(doc(db, 'teams', teamData.id, 'events', eventId));
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title?.trim() || !newEvent.date || !teamData?.id || !userData?.uid) return;

    try {
      await addDoc(collection(db, 'teams', teamData.id, 'events'), {
        title: newEvent.title,
        date: newEvent.date,
        time: newEvent.time || '',
        location: newEvent.location || '',
        description: newEvent.description || '',
        type: newEvent.type || 'Practice',
        createdAt: serverTimestamp(),
        createdBy: userData.uid,
        updatedAt: serverTimestamp(),
      });
      setNewEvent({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        type: 'Practice',
      });
      setShowNewEventForm(false);
    } catch (error) {
      console.error("Error adding event:", error);
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
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bulletin Board */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Bulletin Board</h2>
          {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
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
                  {editingPostId === post.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingPostText}
                        onChange={(e) => setEditingPostText(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPost(post.id)}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded text-sm transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPostId(null)}
                          className="px-3 py-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-900 dark:text-slate-100">{post.text}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          - {post.author} on {formatDate(post.timestamp)}
                        </p>
                        {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditingPostText(post.text);
                              }}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-600 dark:text-slate-400 text-center py-8">No announcements yet.</p>
            )}
          </div>
        </div>

        {/* Team Events */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-sky-500" />
            Upcoming Events
          </h2>

          {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
            <div className="mb-6">
              {showNewEventForm ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg shadow-lg dark:shadow-xl space-y-3">
                  <input
                    type="text"
                    value={newEvent.title || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Event title *"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newEvent.date || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                    />
                    <input
                      type="time"
                      value={newEvent.time || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      placeholder="Time"
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={newEvent.location || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder="Location"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  />
                  <textarea
                    value={newEvent.description || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Description (optional)"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                    rows={2}
                  />
                  <select
                    value={newEvent.type || 'Practice'}
                    onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as 'Practice' | 'Game' | 'Other' })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="Practice">Practice</option>
                    <option value="Game">Game</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddEvent}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded text-sm transition-colors disabled:bg-slate-300 dark:disabled:bg-slate-700"
                      disabled={!newEvent.title?.trim() || !newEvent.date}
                    >
                      Create Event
                    </button>
                    <button
                      onClick={() => setShowNewEventForm(false)}
                      className="px-3 py-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewEventForm(true)}
                  className="w-full px-4 py-2 bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg dark:shadow-xl"
                >
                  <Plus className="w-5 h-5" />
                  Add Event
                </button>
              )}
            </div>
          )}

          <div className={teamEvents.length > 1 ? 'space-y-2' : 'space-y-3'}>
            {eventsLoading ? (
              <p className="text-slate-600 dark:text-slate-400">Loading events...</p>
            ) : teamEvents.length > 0 ? (
              teamEvents.map(event => (
                <div key={event.id} className={`bg-white dark:bg-slate-900 border-l-4 rounded-lg shadow-lg dark:shadow-xl ${
                  teamEvents.length > 1 ? 'p-3' : 'p-4'
                } ${
                  event.type === 'Game' ? 'border-l-red-500' : 
                  event.type === 'Practice' ? 'border-l-blue-500' : 
                  'border-l-slate-500'
                } border border-slate-200 dark:border-slate-800`}>
                  {editingEventId === event.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingEvent.title || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                        placeholder="Event title"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={editingEvent.date || ''}
                          onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        />
                        <input
                          type="time"
                          value={editingEvent.time || ''}
                          onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                          placeholder="Time"
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        />
                      </div>
                      <input
                        type="text"
                        value={editingEvent.location || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                        placeholder="Location"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      />
                      <textarea
                        value={editingEvent.description || ''}
                        onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                        placeholder="Description (optional)"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        rows={2}
                      />
                      <select
                        value={editingEvent.type || 'Other'}
                        onChange={(e) => setEditingEvent({ ...editingEvent, type: e.target.value as 'Practice' | 'Game' | 'Other' })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm py-2 px-3 text-slate-900 dark:text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      >
                        <option value="Practice">Practice</option>
                        <option value="Game">Game</option>
                        <option value="Other">Other</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditEvent(event.id)}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded text-sm transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingEventId(null)}
                          className="px-3 py-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {teamEvents.length > 1 ? (
                        /* Compact List View */
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 dark:text-white truncate">{event.title}</h3>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                                event.type === 'Game' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                event.type === 'Practice' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}>
                                {event.type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {new Date(event.date).toLocaleDateString()} {event.time && `at ${event.time}`}
                              {event.location && ` • ${event.location}`}
                            </p>
                          </div>
                          {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => setEditingEvent(event) || setEditingEventId(event.id)}
                                className="p-1 text-slate-600 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                className="p-1 text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Expanded Single Event View */
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white">{event.title}</h3>
                            <div className="space-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400">
                              <p className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {new Date(event.date).toLocaleDateString()} {event.time && `at ${event.time}`}
                              </p>
                              {event.location && (
                                <p className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  {event.location}
                                </p>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{event.description}</p>
                            )}
                            <span className={`inline-block mt-2 text-xs font-semibold px-2 py-1 rounded ${
                              event.type === 'Game' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                              event.type === 'Practice' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}>
                              {event.type}
                            </span>
                          </div>
                          {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => setEditingEvent(event) || setEditingEventId(event.id)}
                                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(event.id)}
                                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-600 dark:text-slate-400 text-center py-8">No events scheduled.</p>
            )}
          </div>
        </div>
      </div>

      {/* Stat Leaders */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-sky-500" />
          Stat Leaders
        </h2>
        
        {statsLoading ? (
          <p className="text-slate-600 dark:text-slate-400">Loading stats...</p>
        ) : playerStats.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Top Rusher */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg shadow-lg dark:shadow-xl">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Top Rusher (Yds)</p>
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {playerStats.reduce((top, p) => (p.yards > (top?.yards || 0) ? p : top), playerStats[0])?.playerName || '—'}
                </p>
                <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                  {playerStats.reduce((top, p) => (p.yards > (top?.yards || 0) ? p : top), playerStats[0])?.yards || 'N/A'}
                </p>
              </div>
            </div>

            {/* Top Tackler */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg shadow-lg dark:shadow-xl">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Top Tackler (Tkls)</p>
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {playerStats.reduce((top, p) => (p.tackles > (top?.tackles || 0) ? p : top), playerStats[0])?.playerName || '—'}
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {playerStats.reduce((top, p) => (p.tackles > (top?.tackles || 0) ? p : top), playerStats[0])?.tackles || 'N/A'}
                </p>
              </div>
            </div>

            {/* Most TDs */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg shadow-lg dark:shadow-xl">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-2">Most TDs</p>
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {playerStats.reduce((top, p) => (p.tds > (top?.tds || 0) ? p : top), playerStats[0])?.playerName || '—'}
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {playerStats.reduce((top, p) => (p.tds > (top?.tds || 0) ? p : top), playerStats[0])?.tds || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-600 dark:text-slate-400 text-center py-8">No stats recorded yet.</p>
        )}

        <a href="#/stats" className="inline-block text-sky-500 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-300 font-semibold text-sm mt-4 p-2 rounded hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
          View Full Stat Sheet →
        </a>
      </div>
    </div>
  );
};

export default Dashboard;
