import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc, where, getDocs, getDoc } from 'firebase/firestore';
import { uploadFile, deleteFile } from '../services/storage';
import { db } from '../services/firebase';
import { sanitizeText } from '../services/sanitize';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import { getSportConfig } from '../config/sportConfig';
import type { SportType } from '../types';
import { Clipboard, Check, Plus, TrendingUp, Edit2, Trash2, MapPin, Calendar, Trophy, Medal, Sword, Shield, Clock, X, MessageSquare, Info, AlertCircle, Minus, ExternalLink, Copy, Link as LinkIcon, Users, Crown, User, Image, FileText, Paperclip, Zap, Radio, AlertTriangle } from 'lucide-react';
import type { BulletinPost, PlayerSeasonStats, TeamEvent, UserProfile, LiveStream } from '../types';
import { GoLiveModal, LiveStreamBanner, LiveStreamViewer, SaveStreamToLibraryModal } from './livestream';
import SeasonManager from './SeasonManager';
import { TeamRulesInfo } from './TeamRulesInfo';
import { HeadCoachInfractionDashboard } from './headcoach/HeadCoachInfractionDashboard';

// Helper: Format date string (YYYY-MM-DD) to readable format without timezone issues
const formatEventDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
  // Parse as local date by appending time to avoid UTC interpretation
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  return date.toLocaleDateString('en-US', options || { weekday: 'long', month: 'short', day: 'numeric' });
};

// Helper: Convert 24-hour time (HH:MM) to 12-hour format with AM/PM
const formatTime12Hour = (time24: string) => {
  if (!time24) return '';
  const [hourStr, minute] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12; // Convert 0 to 12 for midnight
  return `${hour}:${minute} ${ampm}`;
};

const Dashboard: React.FC = () => {
  const { userData, teamData, players, selectedPlayer } = useAuth();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerSeasonStats[]>([]);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isPublicLinkCopied, setIsPublicLinkCopied] = useState(false);
  
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
  
  // Lightbox state for viewing images full-screen
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const [newEventAttachments, setNewEventAttachments] = useState<File[]>([]);
  const [editingEventAttachments, setEditingEventAttachments] = useState<File[]>([]);
  const [uploadingEventFiles, setUploadingEventFiles] = useState(false);
  const [eventUploadProgress, setEventUploadProgress] = useState<Record<string, number>>({});
  
  // Rate limit error state
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  
  // Delete confirmation modals
  const [deletePostConfirm, setDeletePostConfirm] = useState<{ id: string; text: string; author: string } | null>(null);
  const [deleteEventConfirm, setDeleteEventConfirm] = useState<{ id: string; title: string; date: string } | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  
  // Team Record state
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [editRecord, setEditRecord] = useState({ wins: 0, losses: 0, ties: 0 });
  const [savingRecord, setSavingRecord] = useState(false);

  // Coaching Staff state with coordinator info
  const [coaches, setCoaches] = useState<(UserProfile & { isHeadCoach: boolean; isOC: boolean; isDC: boolean; isSTC: boolean })[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(true);

  // Live Stream state
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [showLiveStreamViewer, setShowLiveStreamViewer] = useState(false);
  const [endedStream, setEndedStream] = useState<LiveStream | null>(null);

  // --- OPTIMIZED STATS CALCULATION (PERFORMANCE FIX) ---
  // Calculates leaders only when playerStats data changes, not on every render
  const topStats = useMemo(() => {
    if (playerStats.length === 0) return null;

    const getTopPlayer = (getValue: (s: PlayerSeasonStats) => number) => {
        return playerStats.reduce((prev, current) => 
            getValue(current) > getValue(prev) ? current : prev
        , playerStats[0]);
    };

    return {
        rusher: getTopPlayer(s => (s.rushYards || 0) + (s.recYards || 0)),
        tackler: getTopPlayer(s => s.tackles || 0),
        scorer: getTopPlayer(s => s.tds || 0)
    };
  }, [playerStats]);

  // Check if current user is the head coach (for infraction dashboard access)
  const isCurrentUserHeadCoach = useMemo(() => {
    if (!user?.uid || !teamData) return false;
    return teamData.headCoachId === user.uid || teamData.coachId === user.uid;
  }, [user?.uid, teamData?.headCoachId, teamData?.coachId]);

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
    // Load current season stats from the new seasonStats collection
    // Note: Removed orderBy to avoid needing composite index - we sort in JS anyway
    const statsQuery = query(
      collection(db, 'teams', teamData.id, 'seasonStats'),
      where('season', '==', currentYear)
    );

    const unsubscribe = onSnapshot(statsQuery, (snapshot) => {
      const statsData = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PlayerSeasonStats));
      setPlayerStats(statsData);
      setStatsLoading(false);
    }, (error) => { console.error("Error fetching stats:", error); setStatsLoading(false); });
    return () => unsubscribe();
  }, [teamData?.id, currentYear]);

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

  // Fetch coaches for this team
  useEffect(() => {
    const fetchCoaches = async () => {
      if (!teamData?.id) return;
      setCoachesLoading(true);
      
      try {
        const usersRef = collection(db, 'users');
        const coachesMap = new Map<string, UserProfile & { isHeadCoach: boolean; isOC: boolean; isDC: boolean; isSTC: boolean }>();
        
        // Query 1: Coaches who have this team in their teamIds array
        const teamIdsQuery = query(
          usersRef,
          where('role', '==', 'Coach'),
          where('teamIds', 'array-contains', teamData.id)
        );
        const teamIdsSnapshot = await getDocs(teamIdsQuery);
        teamIdsSnapshot.forEach(docSnap => {
          const coachData = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
          const isHeadCoach = teamData.headCoachId === docSnap.id || teamData.coachId === docSnap.id;
          const isOC = teamData.offensiveCoordinatorId === docSnap.id;
          const isDC = teamData.defensiveCoordinatorId === docSnap.id;
          const isSTC = teamData.specialTeamsCoordinatorId === docSnap.id;
          coachesMap.set(docSnap.id, { ...coachData, isHeadCoach, isOC, isDC, isSTC });
        });
        
        // Query 2: Coaches with legacy teamId field (who might not have teamIds yet)
        const legacyQuery = query(
          usersRef,
          where('role', '==', 'Coach'),
          where('teamId', '==', teamData.id)
        );
        const legacySnapshot = await getDocs(legacyQuery);
        legacySnapshot.forEach(docSnap => {
          // Only add if not already in the map
          if (!coachesMap.has(docSnap.id)) {
            const coachData = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
            const isHeadCoach = teamData.headCoachId === docSnap.id || teamData.coachId === docSnap.id;
            const isOC = teamData.offensiveCoordinatorId === docSnap.id;
            const isDC = teamData.defensiveCoordinatorId === docSnap.id;
            const isSTC = teamData.specialTeamsCoordinatorId === docSnap.id;
            coachesMap.set(docSnap.id, { ...coachData, isHeadCoach, isOC, isDC, isSTC });
          }
        });
        
        // Convert map to array and sort: head coach first, then coordinators, then alphabetically
        const teamCoaches = Array.from(coachesMap.values()).sort((a, b) => {
          if (a.isHeadCoach && !b.isHeadCoach) return -1;
          if (!a.isHeadCoach && b.isHeadCoach) return 1;
          // Coordinators next
          const aCoord = a.isOC || a.isDC || a.isSTC;
          const bCoord = b.isOC || b.isDC || b.isSTC;
          if (aCoord && !bCoord) return -1;
          if (!aCoord && bCoord) return 1;
          return a.name.localeCompare(b.name);
        });
        
        setCoaches(teamCoaches);
      } catch (error) {
        console.error('Error fetching coaches:', error);
      } finally {
        setCoachesLoading(false);
      }
    };
    
    fetchCoaches();
  }, [teamData?.id, teamData?.headCoachId, teamData?.coachId, teamData?.offensiveCoordinatorId, teamData?.defensiveCoordinatorId, teamData?.specialTeamsCoordinatorId]);

  // Live streams listener
  useEffect(() => {
    if (!teamData?.id) return;
    
    // Listen for active live streams for this team
    const liveStreamsQuery = query(
      collection(db, 'teams', teamData.id, 'liveStreams'),
      where('isLive', '==', true)
    );
    
    const unsubscribe = onSnapshot(liveStreamsQuery, (snapshot) => {
      const streams: LiveStream[] = [];
      snapshot.forEach(docSnap => {
        streams.push({ id: docSnap.id, ...docSnap.data() } as LiveStream);
      });
      // Sort by startedAt (newest first)
      streams.sort((a, b) => {
        const aTime = a.startedAt?.toMillis?.() || 0;
        const bTime = b.startedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setLiveStreams(streams);
    }, (error) => {
      console.error('Error fetching live streams:', error);
    });
    
    return () => unsubscribe();
  }, [teamData?.id]);

  // Event attachments handlers
  const handleNewEventFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setNewEventAttachments(prev => [...prev, ...files].slice(0, 5));
    e.currentTarget.value = '';
  };

  const removeNewEventAttachment = (index: number) => {
    setNewEventAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditingEventFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setEditingEventAttachments(prev => [...prev, ...files].slice(0, 5));
    e.currentTarget.value = '';
  };

  const removeEditingEventAttachment = (index: number) => {
    setEditingEventAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingEventAttachment = async (eventId: string, attIndex: number) => {
    if (!teamData?.id) return;
    try {
      const eventRef = doc(db, 'teams', teamData.id, 'events', eventId);
      const snap = await getDoc(eventRef);
      if (!snap.exists()) return;
      const current = (snap.data() as any).attachments || [];
      const removed = current[attIndex];
      const updated = current.filter((_: any, i: number) => i !== attIndex);

      // If the attachment included a storage path, delete the object from Storage
      if (removed && removed.path) {
        try {
          await deleteFile(removed.path);
        } catch (err) {
          console.warn('Failed to delete storage object for attachment:', err);
        }
      }

      await updateDoc(eventRef, { attachments: updated, updatedAt: serverTimestamp() });
      // Refresh local state by reloading selectedEvent
      const refreshed = { id: eventId, ...(snap.data() as any), attachments: updated } as any;
      setSelectedEvent(refreshed);
    } catch (err) {
      console.error('Failed to remove attachment:', err);
    }
  };

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

  const handleDeletePost = async () => {
    if (!teamData?.id || !deletePostConfirm) return;
    setDeletingPost(true);
    try { 
      await deleteDoc(doc(db, 'teams', teamData.id, 'bulletin', deletePostConfirm.id)); 
      setDeletePostConfirm(null);
      if (selectedPost?.id === deletePostConfirm.id) setSelectedPost(null);
    } catch (error) { console.error("Error deleting post:", error); }
    finally { setDeletingPost(false); }
  };

  const handleEditEvent = async (eventId: string) => {
    if (!teamData?.id || !editingEvent.title?.trim()) return;
    try {
      // SECURITY: Sanitize event data
      // If there are new attachments, upload them and append to existing attachments
      let uploadedAttachments: any[] | undefined = undefined;
      if (editingEventAttachments.length > 0) {
        setUploadingEventFiles(true);
        uploadedAttachments = [];
        for (const file of editingEventAttachments) {
          const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
          const path = `events/${teamData.id}/${safeName}`;
          const uploaded = await uploadFile(file, path, (percent) => setEventUploadProgress(prev => ({ ...prev, [file.name]: percent })));
          uploadedAttachments.push(uploaded);
        }
        setUploadingEventFiles(false);
        setEventUploadProgress({});
        setEditingEventAttachments([]);
      }

      // Load current attachments from the doc to merge
      const eventRef = doc(db, 'teams', teamData.id, 'events', eventId);
      const currentSnap = await getDoc(eventRef);
      const currentAttachments = (currentSnap.exists() ? (currentSnap.data() as any).attachments || [] : []);

      const updatedPayload: any = {
        title: sanitizeText(editingEvent.title || '', 200),
        date: editingEvent.date,
        time: editingEvent.time,
        location: sanitizeText(editingEvent.location || '', 200),
        description: sanitizeText(editingEvent.description || '', 1000),
        type: editingEvent.type,
        updatedAt: serverTimestamp(),
      };

      if (uploadedAttachments && uploadedAttachments.length > 0) {
        updatedPayload.attachments = [...currentAttachments, ...uploadedAttachments];
      }

      await updateDoc(eventRef, updatedPayload);
      setEditingEventId(null); setEditingEvent({});
    } catch (error) { console.error("Error updating event:", error); }
  };

  const handleDeleteEvent = async () => {
    if (!teamData?.id || !deleteEventConfirm) return;
    setDeletingEvent(true);
    try { 
      await deleteDoc(doc(db, 'teams', teamData.id, 'events', deleteEventConfirm.id)); 
      setDeleteEventConfirm(null);
      if (selectedEvent?.id === deleteEventConfirm.id) setSelectedEvent(null);
    } catch (error) { console.error("Error deleting event:", error); }
    finally { setDeletingEvent(false); }
  };

  const handleAddEvent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newEvent.title?.trim() || !newEvent.date || !teamData?.id || !userData?.uid || addingEvent) return;
    setAddingEvent(true);
    try {
      // SECURITY: Sanitize new event data
      const sanitizedEvent: any = {
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

      // Upload any attachments and add to event payload
      if (newEventAttachments.length > 0) {
        setUploadingEventFiles(true);
        const uploaded: any[] = [];
        for (const file of newEventAttachments) {
          const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
          const path = `events/${teamData.id}/${safeName}`;
          const uploadedFile = await uploadFile(file, path, (percent) => setEventUploadProgress(prev => ({ ...prev, [file.name]: percent })));
          uploaded.push(uploadedFile);
        }
        setUploadingEventFiles(false);
        setEventUploadProgress({});
        sanitizedEvent.attachments = uploaded;
        setNewEventAttachments([]);
      }

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

  const copyPublicLink = () => {
    if (teamData?.id) {
      const baseUrl = window.location.origin + window.location.pathname;
      const publicUrl = `${baseUrl}#/team/${teamData.id}`;
      navigator.clipboard.writeText(publicUrl);
      setIsPublicLinkCopied(true);
      setTimeout(() => setIsPublicLinkCopied(false), 2000);
    }
  };
  
  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp.seconds * 1000).toLocaleString();
  };

  // Handle saving team record
  const handleSaveRecord = async () => {
    if (!teamData?.id) return;
    setSavingRecord(true);
    try {
      await updateDoc(doc(db, 'teams', teamData.id), {
        record: {
          wins: Math.max(0, editRecord.wins),
          losses: Math.max(0, editRecord.losses),
          ties: Math.max(0, editRecord.ties)
        }
      });
      setIsEditingRecord(false);
    } catch (error) {
      console.error("Error saving record:", error);
    } finally {
      setSavingRecord(false);
    }
  };

  // Open edit record modal
  const openEditRecord = () => {
    setEditRecord({
      wins: teamData?.record?.wins || 0,
      losses: teamData?.record?.losses || 0,
      ties: teamData?.record?.ties || 0
    });
    setIsEditingRecord(true);
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
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-2">Welcome to OSYS!</h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-lg">Let's get started by adding your first athlete</p>
          </div>
          
          <div className="bg-slate-50 dark:bg-black p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 mb-6">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3 text-left">Quick Start:</h3>
            <ol className="text-left space-y-2 text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">1.</span>
                <span>Go to your <strong>Profile</strong> page using the sidebar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">2.</span>
                <span>Click <strong>"Add Athlete"</strong> in the My Athletes section</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">3.</span>
                <span>Select their team and enter your athlete's information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-orange-600 dark:text-orange-400 flex-shrink-0">4.</span>
                <span>Start accessing team chat, videos, stats, and more!</span>
              </li>
            </ol>
          </div>
          
          <button 
            onClick={() => navigate('/profile', { state: { openAddAthlete: true } })}
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-bold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Your First Athlete
          </button>
        </div>
      </div>
    );
  }

  // Show "Join Team" prompt for parents with players but no team assigned
  if (userData?.role === 'Parent' && players.length > 0 && !teamData) {
    const unassignedPlayer = selectedPlayer || players[0];
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-zinc-950 rounded-2xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-sky-100 dark:bg-sky-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-sky-600 dark:text-sky-400" />
            </div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white mb-2">Join a Team!</h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-lg">
              <strong>{unassignedPlayer?.name || 'Your athlete'}</strong> needs to be assigned to a team
            </p>
          </div>
          
          <div className="bg-slate-50 dark:bg-black p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 mb-6">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3 text-left">How to join a team:</h3>
            <ol className="text-left space-y-2 text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="font-bold text-sky-600 dark:text-sky-400 flex-shrink-0">1.</span>
                <span>Get the <strong>Team ID</strong> from your coach or team admin</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-sky-600 dark:text-sky-400 flex-shrink-0">2.</span>
                <span>Go to your <strong>Profile</strong> page</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-sky-600 dark:text-sky-400 flex-shrink-0">3.</span>
                <span>Click <strong>"(change)"</strong> next to your athlete's team</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-sky-600 dark:text-sky-400 flex-shrink-0">4.</span>
                <span>Select the team to join</span>
              </li>
            </ol>
          </div>
          
          <a 
            href="#/profile" 
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-8 py-3 rounded-lg font-bold transition-colors"
          >
            <Users className="w-5 h-5" />
            Go to Profile to Join Team
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      
      {/* ADD NEW EVENT MODAL */}
      {showNewEventForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowNewEventForm(false); setNewEventAttachments([]); }}>
          <div 
            className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-700 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`${getEventTypeColor(newEvent.type || 'Practice')} p-6 relative`}>
              <button 
                onClick={() => { setShowNewEventForm(false); setNewEventAttachments([]); }} 
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/30 rounded-full p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                {newEvent.type || 'Practice'}
              </span>
              <input 
                value={newEvent.title || ''} 
                onChange={e => setNewEvent({...newEvent, title: e.target.value})} 
                className="text-2xl font-black text-white mt-1 bg-transparent border-b-2 border-white/50 focus:border-white outline-none w-full placeholder-white/50"
                placeholder="Event Title"
              />
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Date</label>
                  <input 
                    type="date" 
                    value={newEvent.date || ''} 
                    onChange={e => setNewEvent({...newEvent, date: e.target.value})} 
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg [&::-webkit-calendar-picker-indicator]:dark:invert"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Time</label>
                  <input 
                    type="time" 
                    value={newEvent.time || ''} 
                    onChange={e => setNewEvent({...newEvent, time: e.target.value})} 
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg [&::-webkit-calendar-picker-indicator]:dark:invert"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Location</label>
                <input 
                  value={newEvent.location || ''} 
                  onChange={e => setNewEvent({...newEvent, location: e.target.value})} 
                  placeholder="Location" 
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Event Type</label>
                <select 
                  value={newEvent.type || 'Practice'} 
                  onChange={e => setNewEvent({...newEvent, type: e.target.value as any})} 
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
                  value={newEvent.description || ''} 
                  onChange={e => setNewEvent({...newEvent, description: e.target.value})} 
                  placeholder="Add notes or details..." 
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg" 
                  rows={4}
                />
              </div>
              {/* Attachments */}
              <div>
                {newEventAttachments.length > 0 && (
                  <div className="mb-2 flex gap-2 flex-wrap">
                    {newEventAttachments.map((f, i) => (
                      <div key={i} className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded flex items-center gap-2 text-sm">
                        <span className="truncate max-w-[150px] text-zinc-700 dark:text-zinc-300">{f.name}</span>
                        <button type="button" onClick={() => removeNewEventAttachment(i)} className="text-zinc-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded text-sm cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                  <input type="file" accept="image/*,application/pdf" multiple onChange={handleNewEventFiles} className="hidden" />
                  <Plus className="w-4 h-4 text-zinc-500" />
                  <span className="text-zinc-600 dark:text-zinc-300">Add attachments</span>
                </label>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-b-2xl">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAddEvent()}
                  disabled={addingEvent || !newEvent.title?.trim() || !newEvent.date}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingEvent ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Save
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setShowNewEventForm(false); setNewEventAttachments([]); }}
                  disabled={addingEvent}
                  className="flex-1 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg [&::-webkit-calendar-picker-indicator]:dark:invert"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Time</label>
                      <input 
                        type="time" 
                        value={editingEvent.time || ''} 
                        onChange={e => setEditingEvent({...editingEvent, time: e.target.value})} 
                        className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white p-3 rounded-lg [&::-webkit-calendar-picker-indicator]:dark:invert"
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
                  {/* Attachments editor */}
                  <div>
                    {((selectedEvent as any)?.attachments || []).length > 0 && (
                      <div className="mb-2 space-y-2">
                        {((selectedEvent as any).attachments || []).map((att: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-2 rounded">
                            <div>
                              {att.mimeType && att.mimeType.startsWith('image') ? (
                                <img src={att.url} className="max-w-xs rounded" alt={att.name} />
                              ) : (
                                <a href={att.url} target="_blank" rel="noreferrer" className="text-sky-500 underline">{att.name}</a>
                              )}
                            </div>
                            <div>
                              <button type="button" onClick={() => removeExistingEventAttachment(selectedEvent.id, idx)} className="text-red-500">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {editingEventAttachments.length > 0 && (
                      <div className="mb-2 flex gap-2 overflow-x-auto">
                        {editingEventAttachments.map((f, i) => (
                          <div key={i} className="bg-zinc-800 px-3 py-1 rounded flex items-center gap-2 text-sm">
                            <span className="truncate max-w-xs">{f.name}</span>
                            <button type="button" onClick={() => removeEditingEventAttachment(i)} className="text-zinc-400 hover:text-white">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded text-sm cursor-pointer">
                      <input type="file" accept="image/*,application/pdf" multiple onChange={handleEditingEventFiles} className="hidden" />
                      <span className="text-zinc-600 dark:text-zinc-300">Add attachments</span>
                    </label>
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
                  {/* Attachments (view mode) */}
                  {(selectedEvent as any).attachments && (selectedEvent as any).attachments.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 mb-3">
                        <Paperclip className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Attachments ({(selectedEvent as any).attachments.length})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {(selectedEvent as any).attachments.map((att: any, i: number) => (
                          <div key={i}>
                            {att.mimeType && att.mimeType.startsWith('image') ? (
                              <div 
                                className="relative aspect-video rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-700 cursor-pointer group"
                                onClick={() => setLightboxImage({ url: att.url, name: att.name })}
                              >
                                <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <Image className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <a 
                                href={att.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="flex items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                              >
                                <FileText className="w-5 h-5 text-sky-500 flex-shrink-0" />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{att.name}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
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
                          setDeleteEventConfirm({ id: selectedEvent.id, title: selectedEvent.title, date: selectedEvent.date });
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
                {/* Only show edit/delete if: SuperAdmin OR the post author */}
                {(userData?.role === 'SuperAdmin' || (userData?.role === 'Coach' && selectedPost.authorId === userData?.uid)) && (
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
                          setDeletePostConfirm({ id: selectedPost.id, text: selectedPost.text, author: selectedPost.author });
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
                    className={`${(userData?.role === 'SuperAdmin' || (userData?.role === 'Coach' && selectedPost.authorId === userData?.uid)) ? 'flex-1' : 'w-full'} py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-lg font-bold transition-colors`}
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
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase italic">{teamData?.name || 'Loading...'}</h1>
                  {/* Sport Badge */}
                  {teamData?.sport && (() => {
                    const sportConfig = getSportConfig(teamData.sport as SportType);
                    return (
                      <span 
                        className="px-3 py-1 rounded-full text-sm font-bold text-white shadow-lg"
                        style={{ backgroundColor: sportConfig.color }}
                      >
                        {sportConfig.emoji} {sportConfig.name}
                      </span>
                    );
                  })()}
                </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Team ID Badge - Visible to all users */}
                    {teamData?.id && (
                      <button onClick={copyTeamId} className="flex items-center gap-2 bg-white/50 dark:bg-zinc-900/50 hover:bg-white/80 dark:hover:bg-zinc-800 border border-slate-400 dark:border-zinc-700 px-3 py-1 rounded-lg text-xs text-zinc-700 dark:text-zinc-400 transition-colors">
                        {isCopied ? <Check className="w-3 h-3 text-green-400"/> : <Clipboard className="w-3 h-3"/>}
                        <span className="font-mono">ID: {teamData?.id}</span>
                      </button>
                    )}
                </div>
                
                {/* Public Team Page Link - Coaches only */}
                {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && teamData?.id && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg">
                      <LinkIcon className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-300 font-medium">Public Page:</span>
                      <span className="text-xs text-purple-400 font-mono truncate max-w-[200px]">
                        osys.team/#/team/{teamData.id}
                      </span>
                    </div>
                    <button
                      onClick={copyPublicLink}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        isPublicLinkCopied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-purple-500 hover:bg-purple-600 text-white'
                      }`}
                    >
                      {isPublicLinkCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                    <a
                      href={`#/team/${teamData.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs font-medium transition-colors"
                      title="View public team page"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </a>
                  </div>
                )}

                {/* Public Team Page Link - Parents */}
                {userData?.role === 'Parent' && teamData?.id && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-lg">
                      <LinkIcon className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-300 font-medium">Share Team Page:</span>
                      <span className="text-xs text-purple-400 font-mono truncate max-w-[200px]">
                        osys.team/#/team/{teamData.id}
                      </span>
                    </div>
                    <button
                      onClick={copyPublicLink}
                      className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                        isPublicLinkCopied
                          ? 'bg-emerald-500 text-white'
                          : 'bg-purple-500 hover:bg-purple-600 text-white'
                      }`}
                    >
                      {isPublicLinkCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                    <a
                      href={`#/team/${teamData.id}`}
                      className="flex items-center gap-1 px-2 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs font-medium transition-colors"
                      title="View public team page"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </a>
                  </div>
                )}
              </div>
          </div>
      </div>

      {/* LIVE STREAM SECTION */}
      {/* Show banner if there are active live streams */}
      {liveStreams.length > 0 && (
        <LiveStreamBanner
          streams={liveStreams}
          teamName={teamData?.name || ''}
          onClick={() => setShowLiveStreamViewer(true)}
        />
      )}
      
      {/* Go Live button for coaches when no active streams from this coach */}
      {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && 
       !liveStreams.some(s => s.coachId === userData?.uid) && (
        <button
          onClick={() => setShowGoLiveModal(true)}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white p-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg group"
        >
          <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
            <Radio className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="font-bold text-lg">Go Live</div>
            <div className="text-sm text-red-100 opacity-80">Start streaming to your team</div>
          </div>
        </button>
      )}

      {/* SEASON MANAGEMENT (Coaches Only) */}
      {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && teamData?.id && (
        <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:to-black rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-xl">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Season Management</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-500">Manage registration and seasons</p>
              </div>
            </div>
            <SeasonManager
              teamId={teamData.id}
              teamName={teamData.name}
              sport={teamData.sport || 'football'}
              currentSeasonId={teamData.currentSeasonId}
              leagueId={teamData.leagueId}
              leagueStatus={teamData.leagueStatus}
              leagueName={teamData.leagueName}
            />
          </div>
        </div>
      )}

      {/* TEAM RECORD */}
      <div className="bg-white dark:bg-gradient-to-br dark:from-zinc-900 dark:to-black rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Season Record</h2>
                <p className="text-xs text-gray-500 dark:text-zinc-500">Track your team's wins & losses</p>
              </div>
            </div>
            {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
              <button 
                onClick={openEditRecord}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-600 dark:text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-gray-200 dark:border-zinc-700"
              >
                <Edit2 className="w-3 h-3" /> Update
              </button>
            )}
          </div>
          
          {/* Record Display */}
          <div className="grid grid-cols-3 gap-4">
            {/* Wins */}
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 text-center">
              <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{teamData?.record?.wins || 0}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-500/70 mt-1">Wins</p>
            </div>
            
            {/* Losses */}
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-4xl font-black text-red-600 dark:text-red-400">{teamData?.record?.losses || 0}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-red-600/70 dark:text-red-500/70 mt-1">Losses</p>
            </div>
            
            {/* Ties */}
            <div className="bg-gray-100 dark:bg-zinc-500/10 border border-gray-200 dark:border-zinc-500/20 rounded-xl p-4 text-center">
              <p className="text-4xl font-black text-gray-600 dark:text-zinc-400">{teamData?.record?.ties || 0}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500/70 mt-1">Ties</p>
            </div>
          </div>
          
          {/* Win Percentage Bar */}
          {((teamData?.record?.wins || 0) + (teamData?.record?.losses || 0) + (teamData?.record?.ties || 0)) > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-500 mb-1">
                <span>Win Rate</span>
                <span className="font-mono">
                  {Math.round(((teamData?.record?.wins || 0) / ((teamData?.record?.wins || 0) + (teamData?.record?.losses || 0) + (teamData?.record?.ties || 0))) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${((teamData?.record?.wins || 0) / ((teamData?.record?.wins || 0) + (teamData?.record?.losses || 0) + (teamData?.record?.ties || 0))) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EDIT RECORD MODAL */}
      {isEditingRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsEditingRecord(false)}>
          <div 
            className="bg-zinc-900 rounded-2xl w-full max-w-sm border border-zinc-700 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-5 rounded-t-2xl sticky top-0">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Update Record</h2>
                  <p className="text-xs text-white/70">Log your team's game results</p>
                </div>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Wins */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 block">Wins</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setEditRecord({...editRecord, wins: Math.max(0, editRecord.wins - 1)})}
                    className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 transition-colors flex-shrink-0"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input 
                    type="number" 
                    min="0"
                    value={editRecord.wins} 
                    onChange={(e) => setEditRecord({...editRecord, wins: parseInt(e.target.value) || 0})}
                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-center text-2xl font-black text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button 
                    onClick={() => setEditRecord({...editRecord, wins: editRecord.wins + 1})}
                    className="w-11 h-11 bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center justify-center text-white transition-colors flex-shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Losses */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2 block">Losses</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setEditRecord({...editRecord, losses: Math.max(0, editRecord.losses - 1)})}
                    className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 transition-colors flex-shrink-0"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input 
                    type="number" 
                    min="0"
                    value={editRecord.losses} 
                    onChange={(e) => setEditRecord({...editRecord, losses: parseInt(e.target.value) || 0})}
                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-center text-2xl font-black text-red-400 outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button 
                    onClick={() => setEditRecord({...editRecord, losses: editRecord.losses + 1})}
                    className="w-11 h-11 bg-red-600 hover:bg-red-500 rounded-lg flex items-center justify-center text-white transition-colors flex-shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Ties */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 block">Ties</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setEditRecord({...editRecord, ties: Math.max(0, editRecord.ties - 1)})}
                    className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-400 transition-colors flex-shrink-0"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input 
                    type="number" 
                    min="0"
                    value={editRecord.ties} 
                    onChange={(e) => setEditRecord({...editRecord, ties: parseInt(e.target.value) || 0})}
                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-center text-2xl font-black text-zinc-400 outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                  <button 
                    onClick={() => setEditRecord({...editRecord, ties: editRecord.ties + 1})}
                    className="w-11 h-11 bg-zinc-600 hover:bg-zinc-500 rounded-lg flex items-center justify-center text-white transition-colors flex-shrink-0"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 rounded-b-2xl flex gap-3 sticky bottom-0">
              <button 
                onClick={() => setIsEditingRecord(false)}
                disabled={savingRecord}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveRecord}
                disabled={savingRecord}
                className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                {savingRecord ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Save Record
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
                   <div className="flex items-center gap-2 text-orange-500 mb-2"><Sword className="w-4 h-4"/><span className="text-[10px] font-bold uppercase tracking-widest">Yards</span></div>
                   <div className="flex justify-between items-end">
                     <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{topStats.rusher?.playerName || '—'}</span>
                     <span className="text-xl font-black text-zinc-900 dark:text-white">{(topStats.rusher?.rushYards || 0) + (topStats.rusher?.recYards || 0)}</span>
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

      {/* COACHING STAFF */}
      <div className="order-2">
        <div className="bg-slate-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Users className="w-6 h-6 text-amber-500" /> Coaching Staff
          </h2>
          
          {coachesLoading ? (
            <p className="text-zinc-500">Loading coaches...</p>
          ) : coaches.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {coaches.map(coach => {
                // Build the role title based on positions
                const getRoleTitle = () => {
                  const titles: string[] = [];
                  if (coach.isHeadCoach) titles.push('HC');
                  if (coach.isOC) titles.push('OC');
                  if (coach.isDC) titles.push('DC');
                  if (coach.isSTC) titles.push('STC');
                  if (titles.length === 0) return 'Coach';
                  return titles.join(' / ');
                };
                
                return (
                <a
                  key={coach.uid}
                  href={`#/coach/${coach.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all"
                >
                  {/* Coach Photo */}
                  <div className="relative mx-auto mb-3">
                    {coach.photoUrl ? (
                      <img 
                        src={coach.photoUrl} 
                        alt={coach.name}
                        className={`w-16 h-16 rounded-full object-cover mx-auto ${
                          coach.isHeadCoach ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-black' : 
                          (coach.isOC || coach.isDC || coach.isSTC) ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-offset-black' : ''
                        }`}
                      />
                    ) : (
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto ${
                        coach.isHeadCoach ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-black' : 
                        (coach.isOC || coach.isDC || coach.isSTC) ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-offset-black' : ''
                      }`}>
                        <User className="w-8 h-8 text-white" />
                      </div>
                    )}
                    {/* Position badges */}
                    {coach.isHeadCoach && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg" title="Head Coach">
                        <Crown className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {coach.isOC && !coach.isHeadCoach && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg" title="Offensive Coordinator">
                        <Sword className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {coach.isDC && !coach.isHeadCoach && !coach.isOC && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg" title="Defensive Coordinator">
                        <Shield className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {coach.isSTC && !coach.isHeadCoach && !coach.isOC && !coach.isDC && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg" title="Special Teams Coordinator">
                        <Zap className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Coach Name */}
                  <p className="font-bold text-zinc-900 dark:text-white text-sm truncate group-hover:text-amber-500 transition-colors">
                    {coach.name}
                  </p>
                  {/* Role badges */}
                  <div className="flex flex-wrap justify-center gap-1 mt-1">
                    {coach.isHeadCoach && (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">HC</span>
                    )}
                    {coach.isOC && (
                      <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">OC</span>
                    )}
                    {coach.isDC && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">DC</span>
                    )}
                    {coach.isSTC && (
                      <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">STC</span>
                    )}
                    {!coach.isHeadCoach && !coach.isOC && !coach.isDC && !coach.isSTC && (
                      <span className="text-[10px] text-zinc-500">Coach</span>
                    )}
                  </div>
                </a>
                );
              })}
            </div>
          ) : (
            <p className="text-zinc-500 italic text-sm text-center py-8">No coaches assigned yet.</p>
          )}
        </div>
      </div>

      {/* TEAM RULES & CODE OF CONDUCT */}
      {teamData?.id && (
        <div className="order-3">
          <TeamRulesInfo 
            teamId={teamData.id}
            canEditTeamRules={userData?.role === 'Coach' || userData?.role === 'SuperAdmin'}
            canEditLeagueRules={userData?.role === 'LeagueOwner' || userData?.role === 'SuperAdmin'}
          />
        </div>
      )}

      {/* HEAD COACH INFRACTION DASHBOARD */}
      {teamData?.id && isCurrentUserHeadCoach && (
        <div className="order-4">
          <HeadCoachInfractionDashboard 
            teamId={teamData.id}
            teamName={teamData.name || 'Team'}
          />
        </div>
      )}

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
                        {/* Only show edit/delete if: SuperAdmin OR the post author */}
                        {(userData?.role === 'SuperAdmin' || (userData?.role === 'Coach' && post.authorId === userData?.uid)) && (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setSelectedPost(post); setEditingPostId(post.id); setEditingPostText(post.text); }} className="text-zinc-400 hover:text-cyan-400"><Edit2 className="w-3 h-3"/></button>
                            <button onClick={() => setDeletePostConfirm({ id: post.id, text: post.text, author: post.author })} className="text-zinc-400 hover:text-red-400"><Trash2 className="w-3 h-3"/></button>
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
                                <p className="text-zinc-700 dark:text-zinc-300 font-mono text-xs">{formatEventDate(event.date, { month: 'short', day: 'numeric' })}</p>
                                <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-500 dark:text-zinc-500 mt-1">
                                    <Clock className="w-3 h-3" /> {formatTime12Hour(event.time)}
                                </div>
                            </div>
                        </div>
                        {event.location && (
                            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-900 flex items-center gap-2 text-xs text-zinc-500">
                                <MapPin className="w-3 h-3" /> {event.location}
                            </div>
                        )}
                        {/* Attachment indicator */}
                        {(event as any).attachments && (event as any).attachments.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            {/* Show small thumbnail for first image attachment */}
                            {(event as any).attachments.some((a: any) => a.mimeType?.startsWith('image')) && (
                              <div 
                                className="relative w-12 h-12 rounded overflow-hidden border border-zinc-300 dark:border-zinc-700 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstImage = (event as any).attachments.find((a: any) => a.mimeType?.startsWith('image'));
                                  if (firstImage) setLightboxImage({ url: firstImage.url, name: firstImage.name });
                                }}
                              >
                                <img 
                                  src={(event as any).attachments.find((a: any) => a.mimeType?.startsWith('image'))?.url} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            {/* Attachment count badge */}
                            <div className="flex items-center gap-1 text-[10px] text-sky-500 bg-sky-500/10 px-2 py-1 rounded">
                              <Paperclip className="w-3 h-3" />
                              <span>{(event as any).attachments.length} {(event as any).attachments.length === 1 ? 'file' : 'files'}</span>
                            </div>
                          </div>
                        )}
                        {/* Tap to view indicator */}
                        {(event.description || ((event as any).attachments && (event as any).attachments.length > 0)) && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-500">
                                <Info className="w-3 h-3" /> Tap to view details
                            </div>
                        )}
                        {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
                            <div className="absolute bottom-2 right-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => { setSelectedEvent(event); setEditingEventId(event.id); setEditingEvent(event); }} className="text-zinc-600 hover:text-cyan-500"><Edit2 className="w-3 h-3"/></button>
                                <button onClick={() => setDeleteEventConfirm({ id: event.id, title: event.title, date: event.date })} className="text-zinc-600 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                            </div>
                        )}
                     </div>
                 )) : <p className="text-zinc-500 italic text-sm text-center py-4">No upcoming events.</p>}
            </div>
            </div>
        </div>

      </div>
      </div>

      {/* DELETE BULLETIN CONFIRMATION MODAL */}
      {deletePostConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Announcement</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setDeletePostConfirm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-700 dark:text-zinc-300 line-clamp-3">
                "{deletePostConfirm.text}"
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2">— {deletePostConfirm.author}</p>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Are you sure you want to delete this announcement? All team members will no longer see it.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeletePostConfirm(null)}
                disabled={deletingPost}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deletingPost}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingPost ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE EVENT CONFIRMATION MODAL */}
      {deleteEventConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Event</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteEventConfirm(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
              <p className="font-bold text-slate-900 dark:text-white">{deleteEventConfirm.title}</p>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
                {formatEventDate(deleteEventConfirm.date, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
              Are you sure you want to delete this event? All team members will no longer see it on the schedule.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteEventConfirm(null)}
                disabled={deletingEvent}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={deletingEvent}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingEvent ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxImage.url} 
              alt={lightboxImage.name} 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <p className="text-center text-white/70 text-sm mt-3">{lightboxImage.name}</p>
          </div>
        </div>
      )}

      {/* GO LIVE MODAL */}
      {showGoLiveModal && teamData && (
        <GoLiveModal
          onClose={() => setShowGoLiveModal(false)}
          teamId={teamData.id}
          teamName={teamData.name}
        />
      )}

      {/* LIVE STREAM VIEWER */}
      {showLiveStreamViewer && teamData && liveStreams.length > 0 && (
        <LiveStreamViewer
          streams={liveStreams}
          teamId={teamData.id}
          teamName={teamData.name}
          onClose={() => setShowLiveStreamViewer(false)}
          isCoach={userData?.role === 'Coach' || userData?.role === 'SuperAdmin'}
          onStreamEnded={(stream) => {
            // Show save to library modal when coach ends their stream
            setEndedStream(stream);
          }}
        />
      )}

      {/* SAVE STREAM TO LIBRARY MODAL */}
      {endedStream && teamData && (
        <SaveStreamToLibraryModal
          stream={endedStream}
          teamId={teamData.id}
          onClose={() => setEndedStream(null)}
          onSaved={() => setEndedStream(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;