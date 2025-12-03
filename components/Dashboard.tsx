import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import { Clipboard, Check, Plus, TrendingUp, Edit2, Trash2, MapPin, Calendar, Trophy, Medal, Sword, Shield, Clock, X, MessageSquare, Info, AlertCircle } from 'lucide-react';
import type { BulletinPost, PlayerStats, TeamEvent } from '../types';

const Dashboard: React.FC = () => {
  const { userData, teamData, players, selectedPlayer } = useAuth();
  
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
  const [eventFilter, setEventFilter] = useState<'All' | 'Practice' | 'Game'>('All');
  
  const [newEvent, setNewEvent] = useState<Partial<TeamEvent>>({
    title: '', date: '', time: '', location: '', description: '', type: 'Practice',
  });

  // Modal state for viewing full details
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
  const [selectedPost, setSelectedPost] = useState<BulletinPost | null>(null);
  
  // Loading states for async operations
  const [addingPost, setAddingPost] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  
  // Rate limit error state
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  // --- OPTIMIZED STATS CALCULATION (PERFORMANCE FIX) ---
  // Calculates leaders only when playerStats data changes, not on every render
  const topStats = useMemo(() => {
    if (playerStats.length === 0) return null;

    const getTopPlayer = (key: keyof PlayerStats) => {
        return playerStats.reduce((prev, current) => 
            ((current[key] as number) || 0) > ((prev[key] as number) || 0) ? current : prev
        , playerStats[0]);
    };

    return {
        rusher: getTopPlayer('yards'),
        tackler: getTopPlayer('tackles'),
        scorer: getTopPlayer('tds')
    };
  }, [playerStats]);

  useEffect(() => {
    if (!teamData?.id) return;
    setLoading(true);
    const postsCollection = collection(db, 'teams', teamData.id, 'bulletin');
    const postsQuery = query(postsCollection, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as BulletinPost));
      setPosts(postsData);
      setLoading(false);
    }, (error) => { console.error("Error fetching posts:", error); setLoading(false); });
    return () => unsubscribe();
  }, [teamData?.id]);

  useEffect(() => {
    if (!teamData?.id) return;
    setStatsLoading(true);
    const statsCollection = collection(db, 'teams', teamData.id, 'playerStats');
    const statsQuery = query(statsCollection, orderBy('tds', 'desc'));

    const unsubscribe = onSnapshot(statsQuery, (snapshot) => {
      const statsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PlayerStats));
      setPlayerStats(statsData);
      setStatsLoading(false);
    }, (error) => { console.error("Error fetching stats:", error); setStatsLoading(false); });
    return () => unsubscribe();
  }, [teamData?.id]);

  useEffect(() => {
    if (!teamData?.id) return;
    setEventsLoading(true);
    const eventsCollection = collection(db, 'teams', teamData.id, 'events');
    const eventsQuery = query(eventsCollection, orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as TeamEvent));
      setTeamEvents(eventsData);
      setEventsLoading(false);
    }, (error) => { console.error("Error fetching events:", error); setEventsLoading(false); });
    return () => unsubscribe();
  }, [teamData?.id]);

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !teamData?.id || !userData?.name || addingPost) return;
    
    // Rate limit check
    const rateLimitKey = `bulletin:${userData.uid}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.BULLETIN_POST);
    
    if (!rateLimitResult.allowed) {
      const seconds = Math.ceil(rateLimitResult.retryAfterMs / 1000);
      setRateLimitError(`Please wait ${seconds}s before posting again.`);
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }
    
    setAddingPost(true);
    setRateLimitError(null);
    try {
      // SECURITY: Sanitize bulletin post before storing
      await addDoc(collection(db, 'teams', teamData.id, 'bulletin'), {
        text: sanitizeText(newPost, 2000), 
        author: sanitizeText(userData.name, 100), 
        authorId: userData.uid, 
        timestamp: serverTimestamp(),
      });
      setNewPost('');
    } catch (error) { console.error("Error adding post:", error); }
    finally { setAddingPost(false); }
  };

  const handleEditPost = async (postId: string) => {
    if (!editingPostText.trim() || !teamData?.id) return;
    try {
      // SECURITY: Sanitize edited post
      await updateDoc(doc(db, 'teams', teamData.id, 'bulletin', postId), { text: sanitizeText(editingPostText, 2000) });
      setEditingPostId(null); setEditingPostText('');
    } catch (error) { console.error("Error updating post:", error); }
  };

  const handleDeletePost = async (postId: string) => {
    if (!teamData?.id) return;
    try { await deleteDoc(doc(db, 'teams', teamData.id, 'bulletin', postId)); } catch (error) { console.error("Error deleting post:", error); }
  };

  const handleEditEvent = async (eventId: string) => {
    if (!teamData?.id || !editingEvent.title?.trim()) return;
    try {
      // SECURITY: Sanitize event data
      await updateDoc(doc(db, 'teams', teamData.id, 'events', eventId), {
        title: sanitizeText(editingEvent.title || '', 200), 
        date: editingEvent.date, 
        time: editingEvent.time,
        location: sanitizeText(editingEvent.location || '', 200), 
        description: sanitizeText(editingEvent.description || '', 1000), 
        type: editingEvent.type,
      });
      setEditingEventId(null); setEditingEvent({});
    } catch (error) { console.error("Error updating event:", error); }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!teamData?.id) return;
    try { await deleteDoc(doc(db, 'teams', teamData.id, 'events', eventId)); } catch (error) { console.error("Error deleting event:", error); }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title?.trim() || !newEvent.date || !teamData?.id || !userData?.uid || addingEvent) return;
    setAddingEvent(true);
    try {
      // SECURITY: Sanitize new event data
      const sanitizedEvent = {
        title: sanitizeText(newEvent.title || '', 200),
        date: newEvent.date,
        time: newEvent.time,
        location: sanitizeText(newEvent.location || '', 200),
        description: sanitizeText(newEvent.description || '', 1000),
        type: newEvent.type,
        createdAt: serverTimestamp(), 
        createdBy: userData.uid, 
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'teams', teamData.id, 'events'), sanitizedEvent);
      setNewEvent({ title: '', date: '', time: '', location: '', description: '', type: 'Practice' });
      setShowNewEventForm(false);
    } catch (error) { console.error("Error adding event:", error); }
    finally { setAddingEvent(false); }
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

  // Get event type styling
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'Game': return 'bg-red-600';
      case 'Practice': return 'bg-orange-600';
      default: return 'bg-zinc-600';
    }
  };

  // Show onboarding for parents without players
  if (userData?.role === 'Parent' && players.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-zinc-950 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-10 h-10 text-orange-600 dark:text-orange-400" />
            </div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-2">Welcome to LockerRoom!</h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-lg">Let's get started by adding your first player</p>
          </div>
          
          <div className="bg-slate-50 dark:bg-black p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 mb-6">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3 text-left">Quick Start:</h3>
            <ol className="text-left space-y-2 text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">1.</span>
                <span>Go to the <strong>Roster</strong> page using the sidebar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">2.</span>
                <span>Click <strong>"Add My Player"</strong> button</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">3.</span>
                <span>Select the team and enter your player's information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">4.</span>
                <span>Start accessing team chat, videos, stats, and more!</span>
              </li>
            </ol>
          </div>
          
          <a 
            href="#/roster" 
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-bold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Your First Player
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      
      {/* EVENT DETAIL MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setSelectedEvent(null); setEditingEventId(null); }}>
          <div 
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-700 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${getEventTypeColor(editingEventId === selectedEvent.id ? (editingEvent.type || selectedEvent.type) : selectedEvent.type)} p-6 relative`}>
              <button 
                onClick={() => { setSelectedEvent(null); setEditingEventId(null); }} 
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                {editingEventId === selectedEvent.id ? (editingEvent.type || selectedEvent.type) : selectedEvent.type}
              </span>
              {editingEventId === selectedEvent.id ? (
                <input 
                  value={editingEvent.title || ''} 
                  onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} 
                  className="text-2xl font-black text-white mt-1 bg-transparent border-b-2 border-white/50 focus:border-white outline-none w-full"
                  placeholder="Event Title"
                />
              ) : (
                <h2 className="text-2xl font-black text-white mt-1">{selectedEvent.title}</h2>
              )}
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {editingEventId === selectedEvent.id ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Date</label>
                      <input 
                        type="date" 
                        value={editingEvent.date || ''} 
                        onChange={e => setEditingEvent({...editingEvent, date: e.target.value})} 
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Time</label>
                      <input 
                        type="time" 
                        value={editingEvent.time || ''} 
                        onChange={e => setEditingEvent({...editingEvent, time: e.target.value})} 
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Location</label>
                    <input 
                      value={editingEvent.location || ''} 
                      onChange={e => setEditingEvent({...editingEvent, location: e.target.value})} 
                      placeholder="Location" 
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Event Type</label>
                    <select 
                      value={editingEvent.type || 'Practice'} 
                      onChange={e => setEditingEvent({...editingEvent, type: e.target.value as any})} 
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg"
                    >
                      <option value="Practice">Practice</option>
                      <option value="Game">Game</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Notes</label>
                    <textarea 
                      value={editingEvent.description || ''} 
                      onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} 
                      placeholder="Add notes or details..." 
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg" 
                      rows={4}
                    />
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  {/* Date & Time */}
                  <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">
                        {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      {selectedEvent.time && (
                        <p className="text-sm text-zinc-500">{selectedEvent.time}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Location */}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300">
                      <div className="w-10 h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">{selectedEvent.location}</p>
                        <p className="text-sm text-zinc-500">Location</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Description/Notes */}
                  {selectedEvent.description && (
                    <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Notes</span>
                      </div>
                      <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{selectedEvent.description}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-b-2xl">
              <div className="flex gap-2">
                {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                  editingEventId === selectedEvent.id ? (
                    /* Edit Mode Buttons */
                    <>
                      <button 
                        onClick={async () => {
                          await handleEditEvent(selectedEvent.id);
                          setSelectedEvent({...selectedEvent, ...editingEvent});
                        }}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" /> Save
                      </button>
                      <button 
                        onClick={() => { setEditingEventId(null); setEditingEvent({}); }}
                        className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    /* View Mode Buttons */
                    <>
                      <button 
                        onClick={() => {
                          setEditingEventId(selectedEvent.id);
                          setEditingEvent(selectedEvent);
                        }}
                        className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button 
                        onClick={() => {
                          handleDeleteEvent(selectedEvent.id);
                          setSelectedEvent(null);
                        }}
                        className="py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )
                )}
                {!(editingEventId === selectedEvent.id) && (
                  <button 
                    onClick={() => setSelectedEvent(null)}
                    className={`${(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') ? 'flex-1' : 'w-full'} py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg font-bold transition-colors`}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULLETIN POST DETAIL MODAL */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setSelectedPost(null); setEditingPostId(null); }}>
          <div 
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-700 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 p-6 relative">
              <button 
                onClick={() => { setSelectedPost(null); setEditingPostId(null); }} 
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Announcement</span>
                  <p className="text-white font-bold">{selectedPost.author}</p>
                </div>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-6">
              {editingPostId === selectedPost.id ? (
                /* Edit Mode */
                <textarea 
                  value={editingPostText} 
                  onChange={e => setEditingPostText(e.target.value)} 
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-4 rounded-lg text-lg leading-relaxed" 
                  rows={6}
                  placeholder="Write your announcement..."
                />
              ) : (
                /* View Mode */
                <p className="text-zinc-700 dark:text-zinc-200 text-lg leading-relaxed whitespace-pre-wrap">{selectedPost.text}</p>
              )}
              
              <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Posted {formatDate(selectedPost.timestamp)}
                </p>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-b-2xl">
              <div className="flex gap-2">
                {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                  editingPostId === selectedPost.id ? (
                    /* Edit Mode Buttons */
                    <>
                      <button 
                        onClick={async () => {
                          await handleEditPost(selectedPost.id);
                          setSelectedPost({...selectedPost, text: editingPostText});
                        }}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" /> Save
                      </button>
                      <button 
                        onClick={() => { setEditingPostId(null); setEditingPostText(''); }}
                        className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    /* View Mode Buttons */
                    <>
                      <button 
                        onClick={() => {
                          setEditingPostId(selectedPost.id);
                          setEditingPostText(selectedPost.text);
                        }}
                        className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button 
                        onClick={() => {
                          handleDeletePost(selectedPost.id);
                          setSelectedPost(null);
                        }}
                        className="py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )
                )}
                {!(editingPostId === selectedPost.id) && (
                  <button 
                    onClick={() => setSelectedPost(null)}
                    className={`${(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') ? 'flex-1' : 'w-full'} py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg font-bold transition-colors`}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
        <div className="bg-gradient-to-br from-slate-200 to-slate-300 dark:from-zinc-800 dark:to-black rounded-2xl p-8 border border-slate-300 dark:border-zinc-700 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Trophy className="w-64 h-64 text-white" /></div>
          <div className="relative z-10">
                <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white mb-2 uppercase italic">{teamData?.name || 'Loading...'}</h1>
              <div className="flex items-center gap-4">
                    {/* Team ID Badge */}
                    {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                      <button onClick={copyTeamId} className="flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 hover:bg-white/80 dark:hover:bg-zinc-800 border border-slate-400 dark:border-zinc-700 px-3 py-1 rounded-lg text-xs text-zinc-700 dark:text-zinc-400 transition-colors">
                        {isCopied ? <Check className="w-3 h-3 text-green-400"/> : <Clipboard className="w-3 h-3"/>}
                        <span className="font-mono">ID: {teamData?.id}</span>
                      </button>
                    )}
              </div>
          </div>
      </div>
      
      <div className="space-y-8">
      {/* STAT LEADERS */}
      <div className="order-1">
            <div className="bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-lg">
             <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
               <TrendingUp className="w-6 h-6 text-yellow-500" /> Stat Leaders
             </h2>
             {statsLoading ? <p className="text-zinc-500">Loading stats...</p> : playerStats.length > 0 && topStats ? (
               <div className="grid md:grid-cols-3 gap-4">
                 
                 {/* RUSHER CARD */}
                 <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg">
                   <div className="flex items-center gap-2 text-orange-500 mb-2"><Sword className="w-4 h-4"/><span className="text-[10px] font-bold uppercase tracking-widest">Rusher (Yds)</span></div>
                   <div className="flex justify-between items-end">
                     <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{topStats.rusher?.playerName || '—'}</span>
                     <span className="text-xl font-black text-zinc-900 dark:text-white">{topStats.rusher?.yards || '0'}</span>
                   </div>
                 </div>

                 {/* TACKLER CARD */}
                 <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg">
                   <div className="flex items-center gap-2 text-cyan-500 mb-2"><Shield className="w-4 h-4"/><span className="text-[10px] font-bold uppercase tracking-widest">Tackler</span></div>
                   <div className="flex justify-between items-end">
                     <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{topStats.tackler?.playerName || '—'}</span>
                     <span className="text-xl font-black text-zinc-900 dark:text-white">{topStats.tackler?.tackles || '0'}</span>
                   </div>
                 </div>

                 {/* SCORER CARD */}
                 <div className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg">
                   <div className="flex items-center gap-2 text-lime-500 mb-2"><Trophy className="w-4 h-4"/><span className="text-[10px] font-bold uppercase tracking-widest">Scoring</span></div>
                   <div className="flex justify-between items-end">
                     <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{topStats.scorer?.playerName || '—'}</span>
                     <span className="text-xl font-black text-zinc-900 dark:text-white">{topStats.scorer?.tds || '0'}</span>
                   </div>
                 </div>

               </div>
             ) : <p className="text-zinc-500 italic text-sm text-center py-8">No stats recorded yet.</p>}
             <a href="#/stats" className="inline-block text-cyan-500 hover:text-cyan-400 font-bold text-xs mt-4 uppercase tracking-wider">View Full Stat Sheet →</a>
           </div>
        </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* BULLETIN BOARD */}
        <div className="order-3">
            <div className="bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
                  Bulletin Board
              </h2>
              {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                <>
                {rateLimitError && (
                  <div className="mb-4 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-900/30">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {rateLimitError}
                  </div>
                )}
                <form onSubmit={handleAddPost} className="mb-6 flex items-center gap-4">
                  <input type="text" value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Post an announcement..." className="flex-1 bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
                  <button type="submit" aria-label="Post announcement" className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-lg transition-colors disabled:opacity-50" disabled={!newPost.trim() || addingPost}>
                    {addingPost ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </form>
                </>
              )}
              <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
                {loading ? <p className="text-zinc-500">Loading...</p> : posts.length > 0 ? posts.map(post => (
                  <div 
                    key={post.id} 
                    className="bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800/50 relative group hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors cursor-pointer"
                    onClick={() => setSelectedPost(post)}
                  >
                    <p className="text-zinc-800 dark:text-zinc-200 text-sm line-clamp-2">{post.text}</p>
                    {post.text.length > 100 && (
                      <p className="text-xs text-orange-500 mt-1">Tap to read more</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">- {post.author} • {formatDate(post.timestamp)}</p>
                        {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setSelectedPost(post); setEditingPostId(post.id); setEditingPostText(post.text); }} className="text-zinc-400 hover:text-cyan-400"><Edit2 className="w-3 h-3"/></button>
                            <button onClick={() => handleDeletePost(post.id)} className="text-zinc-400 hover:text-red-400"><Trash2 className="w-3 h-3"/></button>
                          </div>
                        )}
                    </div>
                  </div>
                )) : <p className="text-zinc-500 italic text-sm">No announcements yet.</p>}
              </div>
            </div>
        </div>

        {/* EVENTS */}
        <div className="order-2">
            <div className="bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
                    <Calendar className="w-6 h-6 text-orange-500" /> Events
                </h2>
                {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                    <button onClick={() => setShowNewEventForm(!showNewEventForm)} className="bg-orange-600 hover:bg-orange-500 text-white p-1.5 rounded-lg transition-colors">
                        <Plus className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* FILTER TABS */}
            <div className="flex gap-2 mb-4">
                {(['All', 'Practice', 'Game'] as const).map((filter) => (
                    <button
                        key={filter}
                        onClick={() => setEventFilter(filter)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                            eventFilter === filter
                                ? 'bg-orange-600 text-white shadow-lg'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                        }`}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            {showNewEventForm && (
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 mb-4 animate-in slide-in-from-top-2 space-y-3">
                    <input value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="Event Title" className="w-full bg-black border border-zinc-800 rounded p-2 text-sm text-white"/>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="bg-black border border-zinc-800 rounded p-2 text-sm text-white"/>
                        <input type="time" value={newEvent.time} onChange={e => setNewEvent({...newEvent, time: e.target.value})} className="bg-black border border-zinc-800 rounded p-2 text-sm text-white"/>
                    </div>
                    <input value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} placeholder="Location" className="w-full bg-black border border-zinc-800 rounded p-2 text-sm text-white"/>
                    <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="Description" className="w-full bg-black border border-zinc-800 rounded p-2 text-sm text-white"/>
                    <select value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as any})} className="w-full bg-black border border-zinc-800 rounded p-2 text-sm text-white">
                        <option>Practice</option><option>Game</option><option>Other</option>
                    </select>
                    <div className="flex gap-2">
                        <button onClick={handleAddEvent} disabled={addingEvent} aria-label="Add event" className="flex-1 bg-emerald-600 text-white py-2 rounded text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1">
                          {addingEvent ? (
                            <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                          ) : (
                            'Add'
                          )}
                        </button>
                        <button onClick={() => setShowNewEventForm(false)} disabled={addingEvent} className="flex-1 bg-zinc-700 text-white py-2 rounded text-xs">Cancel</button>
                    </div>
                </div>
            )}

            <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                 {eventsLoading ? <p className="text-zinc-500">Loading...</p> : teamEvents.filter(event => eventFilter === 'All' || event.type?.toLowerCase() === eventFilter.toLowerCase()).length > 0 ? teamEvents.filter(event => eventFilter === 'All' || event.type?.toLowerCase() === eventFilter.toLowerCase()).map(event => (
                     <div 
                       key={event.id} 
                       className="relative bg-zinc-50 dark:bg-black p-4 rounded-lg border-l-4 border-l-orange-500 border-t border-t-zinc-200 dark:border-t-zinc-800 border-b border-b-zinc-200 dark:border-b-zinc-800 border-r border-r-zinc-200 dark:border-r-zinc-800 group cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-colors"
                       onClick={() => setSelectedEvent(event)}
                     >
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-zinc-900 dark:text-white font-bold text-sm">{event.title}</h4>
                                <p className="text-orange-600 dark:text-orange-500 text-[10px] uppercase font-black tracking-wider mt-1">{event.type}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-zinc-700 dark:text-zinc-300 font-mono text-xs">{new Date(event.date).toLocaleDateString()}</p>
                                <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-500 dark:text-zinc-500 mt-1">
                                    <Clock className="w-3 h-3" /> {event.time}
                                </div>
                            </div>
                        </div>
                        {event.location && (
                            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-900 flex items-center gap-2 text-xs text-zinc-500">
                                <MapPin className="w-3 h-3" /> {event.location}
                            </div>
                        )}
                        {/* Tap to view indicator */}
                        {event.description && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-500">
                                <Info className="w-3 h-3" /> Tap to view details
                            </div>
                        )}
                        {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                            <div className="absolute bottom-2 right-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => { setSelectedEvent(event); setEditingEventId(event.id); setEditingEvent(event); }} className="text-zinc-600 hover:text-cyan-500"><Edit2 className="w-3 h-3"/></button>
                                <button onClick={() => handleDeleteEvent(event.id)} className="text-zinc-600 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                            </div>
                        )}
                     </div>
                 )) : <p className="text-zinc-500 italic text-sm text-center py-4">No upcoming events.</p>}
            </div>
            </div>
        </div>

      </div>
      </div>
    </div>
  );
};

export default Dashboard;