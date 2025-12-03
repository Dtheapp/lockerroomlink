import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Clipboard, Check, Plus, TrendingUp, Edit2, Trash2, MapPin, Calendar, Trophy, Medal, Sword, Shield, Clock } from 'lucide-react';
import type { BulletinPost, PlayerStats, TeamEvent } from '../types';
import PlayerSelector from './PlayerSelector';

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
    const q = query(postsCollection, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BulletinPost));
      setPosts(postsData);
      setLoading(false);
    }, (error) => { console.error("Error fetching posts:", error); setLoading(false); });
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
    }, (error) => { console.error("Error fetching stats:", error); setStatsLoading(false); });
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
    }, (error) => { console.error("Error fetching events:", error); setEventsLoading(false); });
    return () => unsubscribe();
  }, [teamData?.id]);

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() || !teamData?.id || !userData?.name) return;
    try {
      await addDoc(collection(db, 'teams', teamData.id, 'bulletin'), {
        text: newPost, author: userData.name, authorId: userData.uid, timestamp: serverTimestamp(),
      });
      setNewPost('');
    } catch (error) { console.error("Error adding post:", error); }
  };

  const handleEditPost = async (postId: string) => {
    if (!editingPostText.trim() || !teamData?.id) return;
    try {
      await updateDoc(doc(db, 'teams', teamData.id, 'bulletin', postId), { text: editingPostText });
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
      await updateDoc(doc(db, 'teams', teamData.id, 'events', eventId), {
        title: editingEvent.title, date: editingEvent.date, time: editingEvent.time,
        location: editingEvent.location, description: editingEvent.description, type: editingEvent.type,
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
    if (!newEvent.title?.trim() || !newEvent.date || !teamData?.id || !userData?.uid) return;
    try {
      await addDoc(collection(db, 'teams', teamData.id, 'events'), {
        ...newEvent, createdAt: serverTimestamp(), createdBy: userData.uid, updatedAt: serverTimestamp(),
      });
      setNewEvent({ title: '', date: '', time: '', location: '', description: '', type: 'Practice' });
      setShowNewEventForm(false);
    } catch (error) { console.error("Error adding event:", error); }
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
      
      {/* PLAYER SELECTOR (For Parents with multiple children) */}
      <PlayerSelector />
      
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
                <form onSubmit={handleAddPost} className="mb-6 flex items-center gap-4">
                  <input type="text" value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="Post an announcement..." className="flex-1 bg-zinc-50 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-zinc-900 dark:text-white focus:border-orange-500 outline-none" />
                  <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-lg transition-colors disabled:opacity-50" disabled={!newPost.trim()}>
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              )}
              <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar">
                {loading ? <p className="text-zinc-500">Loading...</p> : posts.length > 0 ? posts.map(post => (
                  <div key={post.id} className="bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800/50 relative group hover:border-zinc-700 transition-colors">
                    {editingPostId === post.id ? (
                      <div className="space-y-3">
                        <textarea value={editingPostText} onChange={(e) => setEditingPostText(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white text-sm" rows={3}/>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditPost(post.id)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Save</button>
                          <button onClick={() => setEditingPostId(null)} className="px-3 py-1 bg-zinc-600 text-white rounded text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-zinc-800 dark:text-zinc-200 text-sm">{post.text}</p>
                        <div className="flex items-center justify-between mt-3">
                            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">- {post.author} • {formatDate(post.timestamp)}</p>
                            {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                              /* UX FIX: Always visible on mobile, hover only on desktop */
                              <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingPostId(post.id); setEditingPostText(post.text); }} className="text-zinc-400 hover:text-cyan-400"><Edit2 className="w-3 h-3"/></button>
                                <button onClick={() => handleDeletePost(post.id)} className="text-zinc-400 hover:text-red-400"><Trash2 className="w-3 h-3"/></button>
                              </div>
                            )}
                        </div>
                      </>
                    )}
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
                        <button onClick={handleAddEvent} className="flex-1 bg-emerald-600 text-white py-2 rounded text-xs font-bold">Add</button>
                        <button onClick={() => setShowNewEventForm(false)} className="flex-1 bg-zinc-700 text-white py-2 rounded text-xs">Cancel</button>
                    </div>
                </div>
            )}

            <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                 {eventsLoading ? <p className="text-zinc-500">Loading...</p> : teamEvents.filter(event => eventFilter === 'All' || event.type === eventFilter).length > 0 ? teamEvents.filter(event => eventFilter === 'All' || event.type === eventFilter).map(event => (
                     <div key={event.id} className="relative bg-zinc-50 dark:bg-black p-4 rounded-lg border-l-4 border-l-orange-500 border-t border-t-zinc-800 border-b border-b-zinc-800 border-r border-r-zinc-800 group">
                         {editingEventId === event.id ? (
                             <div className="space-y-2">
                                 <input value={editingEvent.title} onChange={e => setEditingEvent({...editingEvent, title: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs p-1"/>
                                 <div className="flex gap-2">
                                     <button onClick={() => handleEditEvent(event.id)} className="text-xs text-emerald-500">Save</button>
                                     <button onClick={() => setEditingEventId(null)} className="text-xs text-zinc-500">Cancel</button>
                                 </div>
                             </div>
                         ) : (
                             <>
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
                                {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                                    /* UX FIX: Always visible on mobile, hover only on desktop */
                                    <div className="absolute bottom-2 right-2 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingEventId(event.id); setEditingEvent(event); }} className="text-zinc-600 hover:text-cyan-500"><Edit2 className="w-3 h-3"/></button>
                                        <button onClick={() => handleDeleteEvent(event.id)} className="text-zinc-600 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                    </div>
                                )}
                             </>
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