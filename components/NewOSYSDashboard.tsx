import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import NoAthleteBlock from './NoAthleteBlock';
import { getStats, getSportConfig } from '../config/sportConfig';
import { uploadFile, deleteFile } from '../services/storage';
import {
  GlassCard,
  Badge,
  Avatar,
} from './ui/OSYSComponents';
import { GoLiveModal, LiveStreamBanner, LiveStreamViewer, SaveStreamToLibraryModal } from './livestream';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import { sanitizeText } from '../services/sanitize';
import GettingStartedChecklist from './GettingStartedChecklist';
import SeasonManager, { type RegistrationFlyerData } from './SeasonManager';
import { DraftPool } from './draftpool';
import type { LiveStream, BulletinPost, UserProfile, ProgramSeason } from '../types';
import { Plus, X, Calendar, MapPin, Clock, Edit2, Trash2, Paperclip, Image, Copy, ExternalLink, Share2, Link2, Check, Palette, ChevronRight } from 'lucide-react';

// Extended event type with attachments
interface EventWithAttachments {
  id: string;
  title: string;
  date?: string;
  eventStartDate?: string;
  time?: string;
  eventStartTime?: string;
  type?: string;
  eventType?: string;
  location?: string;
  description?: string;
  attachments?: { name: string; url: string; type: string }[];
  createdBy?: string;
  createdAt?: any;
}

interface PlayerData {
  id: string;
  name: string;
  jerseyNumber?: string;
  position?: string;
  isActive?: boolean;
  [key: string]: any;
}

interface EventData {
  id: string;
  title: string;
  eventType?: string;
  eventStartDate?: any;
  eventStartTime?: string;
  location?: string;
  [key: string]: any;
}

interface PlayData {
  id: string;
  createdAt?: any;
  [key: string]: any;
}

interface CoachDisplay {
  uid: string;
  name: string;
  photoUrl?: string;
  username?: string;
  isHeadCoach?: boolean;
  isOC?: boolean;
  isDC?: boolean;
  isSTC?: boolean;
}

const NewOSYSDashboard: React.FC = () => {
  const { teamData, userData, players } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [roster, setRoster] = useState<PlayerData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [plays, setPlays] = useState<PlayData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Copy states
  const [isCopied, setIsCopied] = useState(false);
  const [isPublicLinkCopied, setIsPublicLinkCopied] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  
  // Live stream state
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [showLiveStreamViewer, setShowLiveStreamViewer] = useState(false);

  // Bulletin state
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [addingPost, setAddingPost] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [deletePostConfirm, setDeletePostConfirm] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Coaching staff state
  const [coaches, setCoaches] = useState<CoachDisplay[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(true);

  // Go Live & Save Stream state
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [endedStream, setEndedStream] = useState<LiveStream | null>(null);

  // Edit Record state
  const [isEditingRecord, setIsEditingRecord] = useState(false);
  const [editRecord, setEditRecord] = useState({ wins: 0, losses: 0, ties: 0 });
  const [savingRecord, setSavingRecord] = useState(false);

  // Getting Started checklist state
  const [showChecklist, setShowChecklist] = useState(() => {
    const dismissed = localStorage.getItem(`osys_checklist_dismissed_${userData?.uid}`);
    return dismissed !== 'true';
  });

  // Current season registration close date (for DraftPool)
  const [registrationCloseDate, setRegistrationCloseDate] = useState<Date | null>(null);

  // Program season state (for teams in a program)
  const [programSeasons, setProgramSeasons] = useState<ProgramSeason[]>([]);
  const [loadingProgramSeasons, setLoadingProgramSeasons] = useState(false);
  const [copiedSeasonLink, setCopiedSeasonLink] = useState<string | null>(null);

  // Event management state
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithAttachments | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<EventWithAttachments>>({});
  const [newEvent, setNewEvent] = useState<Partial<EventWithAttachments>>({
    title: '', date: '', time: '', location: '', description: '', type: 'Practice',
  });
  const [addingEvent, setAddingEvent] = useState(false);
  const [deleteEventConfirm, setDeleteEventConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [eventFilter, setEventFilter] = useState<'All' | 'Practice' | 'Game'>('All');
  
  // Event attachments
  const [newEventAttachments, setNewEventAttachments] = useState<File[]>([]);
  const [editingEventAttachments, setEditingEventAttachments] = useState<File[]>([]);
  const [uploadingEventFiles, setUploadingEventFiles] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Get sport config
  const sportConfig = getSportConfig(teamData?.sport);
  const sportStats = getStats(teamData?.sport);

  // Fetch real data
  useEffect(() => {
    if (!teamData?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch roster from players subcollection
        const playersRef = collection(db, 'teams', teamData.id, 'players');
        const playersSnap = await getDocs(playersRef);
        setRoster(playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerData)));

        // Fetch plays
        const playsRef = collection(db, 'teams', teamData.id, 'plays');
        const playsSnap = await getDocs(playsRef);
        setPlays(playsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayData)));

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();

    // Real-time events listener
    const eventsRef = collection(db, 'teams', teamData.id, 'events');
    const eventsQuery = query(eventsRef, orderBy('eventStartDate', 'asc'), limit(5));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventData)));
    }, (error) => {
      console.error('Error fetching events:', error);
    });

    // Live streams listener
    const liveStreamsQuery = query(
      collection(db, 'teams', teamData.id, 'liveStreams'),
      where('isLive', '==', true)
    );
    const unsubscribeLive = onSnapshot(liveStreamsQuery, (snapshot) => {
      const streams: LiveStream[] = [];
      snapshot.forEach(docSnap => {
        streams.push({ id: docSnap.id, ...docSnap.data() } as LiveStream);
      });
      streams.sort((a, b) => {
        const aTime = a.startedAt?.toMillis?.() || 0;
        const bTime = b.startedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      setLiveStreams(streams);
    }, (error) => {
      console.error('Error fetching live streams:', error);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeLive();
    };
  }, [teamData?.id]);

  // Fetch bulletin posts
  useEffect(() => {
    if (!teamData?.id) return;

    const bulletinRef = collection(db, 'teams', teamData.id, 'bulletin');
    const bulletinQuery = query(bulletinRef, orderBy('timestamp', 'desc'), limit(20));

    const unsubscribeBulletin = onSnapshot(bulletinQuery, (snapshot) => {
      const bulletinPosts: BulletinPost[] = [];
      snapshot.forEach(docSnap => {
        bulletinPosts.push({ id: docSnap.id, ...docSnap.data() } as BulletinPost);
      });
      setPosts(bulletinPosts);
    }, (error) => {
      console.error('Error fetching bulletin posts:', error);
    });

    return () => unsubscribeBulletin();
  }, [teamData?.id]);

  // Fetch coaching staff
  useEffect(() => {
    if (!teamData?.id) {
      setCoachesLoading(false);
      return;
    }

    const fetchCoaches = async () => {
      try {
        const usersRef = collection(db, 'users');
        const coachesMap = new Map<string, CoachDisplay>();

        // Query coaches by teamIds array
        const teamIdsQuery = query(
          usersRef,
          where('role', '==', 'Coach'),
          where('teamIds', 'array-contains', teamData.id)
        );
        const teamIdsSnap = await getDocs(teamIdsQuery);
        teamIdsSnap.forEach(docSnap => {
          const data = docSnap.data() as UserProfile;
          const isHeadCoach = teamData.headCoachId === docSnap.id || teamData.coachId === docSnap.id;
          const isOC = teamData.offensiveCoordinatorId === docSnap.id;
          const isDC = teamData.defensiveCoordinatorId === docSnap.id;
          const isSTC = teamData.specialTeamsCoordinatorId === docSnap.id;
          coachesMap.set(docSnap.id, { 
            uid: docSnap.id, 
            name: data.name, 
            photoUrl: data.photoUrl, 
            username: data.username,
            isHeadCoach, 
            isOC, 
            isDC, 
            isSTC 
          });
        });

        // Query coaches by legacy teamId field
        const legacyQuery = query(
          usersRef,
          where('role', '==', 'Coach'),
          where('teamId', '==', teamData.id)
        );
        const legacySnap = await getDocs(legacyQuery);
        legacySnap.forEach(docSnap => {
          if (!coachesMap.has(docSnap.id)) {
            const data = docSnap.data() as UserProfile;
            const isHeadCoach = teamData.headCoachId === docSnap.id || teamData.coachId === docSnap.id;
            const isOC = teamData.offensiveCoordinatorId === docSnap.id;
            const isDC = teamData.defensiveCoordinatorId === docSnap.id;
            const isSTC = teamData.specialTeamsCoordinatorId === docSnap.id;
            coachesMap.set(docSnap.id, { 
              uid: docSnap.id, 
              name: data.name, 
              photoUrl: data.photoUrl, 
              username: data.username,
              isHeadCoach, 
              isOC, 
              isDC, 
              isSTC 
            });
          }
        });

        // Sort: HC first, then coordinators, then alphabetically
        const coachesList = Array.from(coachesMap.values()).sort((a, b) => {
          if (a.isHeadCoach && !b.isHeadCoach) return -1;
          if (!a.isHeadCoach && b.isHeadCoach) return 1;
          const aIsCoord = a.isOC || a.isDC || a.isSTC;
          const bIsCoord = b.isOC || b.isDC || b.isSTC;
          if (aIsCoord && !bIsCoord) return -1;
          if (!aIsCoord && bIsCoord) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setCoaches(coachesList);
        setCoachesLoading(false);
      } catch (error) {
        console.error('Error fetching coaches:', error);
        setCoachesLoading(false);
      }
    };

    fetchCoaches();
  }, [teamData?.id, teamData?.headCoachId, teamData?.coachId, teamData?.offensiveCoordinatorId, teamData?.defensiveCoordinatorId, teamData?.specialTeamsCoordinatorId]);

  // Fetch current season for registrationCloseDate
  useEffect(() => {
    if (!teamData?.id) return;
    
    const fetchCurrentSeason = async () => {
      try {
        const seasonsRef = collection(db, 'teams', teamData.id, 'seasons');
        const seasonsSnap = await getDocs(seasonsRef);
        
        // Find active season (isActive = true or most recent)
        let activeSeason: any = null;
        seasonsSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.isActive) {
            activeSeason = { id: docSnap.id, ...data };
          }
        });
        
        // If no active season, find the most recent one
        if (!activeSeason && !seasonsSnap.empty) {
          const seasons = seasonsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          activeSeason = seasons.sort((a: any, b: any) => {
            const aDate = a.registrationCloseDate || '';
            const bDate = b.registrationCloseDate || '';
            return bDate.localeCompare(aDate);
          })[0];
        }
        
        if (activeSeason?.registrationCloseDate) {
          // registrationCloseDate is stored as YYYY-MM-DD string
          const closeDate = new Date(activeSeason.registrationCloseDate + 'T23:59:59');
          setRegistrationCloseDate(closeDate);
        } else {
          setRegistrationCloseDate(null);
        }
      } catch (error) {
        console.error('Error fetching current season:', error);
        setRegistrationCloseDate(null);
      }
    };
    
    fetchCurrentSeason();
  }, [teamData?.id]);

  // Fetch program seasons if team belongs to a program
  useEffect(() => {
    const programId = teamData?.programId;
    if (!programId) {
      setProgramSeasons([]);
      return;
    }

    setLoadingProgramSeasons(true);
    
    // Real-time listener for program seasons
    const seasonsRef = collection(db, 'programs', programId, 'seasons');
    const q = query(seasonsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const seasons = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProgramSeason));
      setProgramSeasons(seasons);
      setLoadingProgramSeasons(false);
    }, (error) => {
      console.error('Error fetching program seasons:', error);
      setLoadingProgramSeasons(false);
    });

    return () => unsubscribe();
  }, [teamData?.programId]);

  // Copy team ID
  const copyTeamId = () => {
    if (teamData?.id) {
      navigator.clipboard.writeText(teamData.id);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Copy public team link
  const copyPublicLink = () => {
    if (teamData?.id) {
      const baseUrl = window.location.origin + window.location.pathname;
      const publicUrl = `${baseUrl}#/team/${teamData.id}`;
      navigator.clipboard.writeText(publicUrl);
      setIsPublicLinkCopied(true);
      setTimeout(() => setIsPublicLinkCopied(false), 2000);
    }
  };

  // Get public URL
  const getPublicUrl = () => {
    if (!teamData?.id) return '';
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#/team/${teamData.id}`;
  };

  // Social share functions
  const shareToFacebook = () => {
    const url = encodeURIComponent(getPublicUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
    setShowShareDropdown(false);
  };

  const shareToTwitter = () => {
    const url = encodeURIComponent(getPublicUrl());
    const text = encodeURIComponent(`Check out ${teamData?.name || 'our team'} on OSYS!`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
    setShowShareDropdown(false);
  };

  const shareToLinkedIn = () => {
    const url = encodeURIComponent(getPublicUrl());
    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}`, '_blank', 'width=600,height=400');
    setShowShareDropdown(false);
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out ${teamData?.name || 'our team'} on OSYS`);
    const body = encodeURIComponent(`I wanted to share our team page with you: ${getPublicUrl()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShowShareDropdown(false);
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Calculate team record from stats
  const getTeamRecord = () => {
    const wins = teamData?.record?.wins || 0;
    const losses = teamData?.record?.losses || 0;
    return `${wins}-${losses}`;
  };

  // State for Season Management modal
  const [showSeasonManager, setShowSeasonManager] = useState(false);

  // Check if user is an independent athlete (18+ signup or released player)
  const isIndependentAthlete = userData?.role === 'Athlete' && (userData?.isIndependentAthlete === true);
  
  // Can the user access advanced features like Go Live, Fundraise?
  const canAccessAdvancedFeatures = userData?.role === 'Coach' || userData?.role === 'SuperAdmin' || isIndependentAthlete;

  // Quick actions based on sport and role
  const quickActions = [
    { icon: '📋', label: 'New Play', link: '/playbook' },
    // Go Live - coaches and independent athletes only
    ...(canAccessAdvancedFeatures 
      ? [{ icon: '📺', label: 'Go Live', action: () => setShowGoLiveModal(true) }]
      : []
    ),
    { icon: '📢', label: 'Announce', link: '/chat' },
    { icon: '📊', label: 'Log Stats', link: '/stats' },
    // Fundraise - coaches and independent athletes only  
    ...(canAccessAdvancedFeatures 
      ? [{ icon: '💰', label: 'Fundraise', link: '/fundraising' }]
      : []
    ),
    { icon: '💫', label: 'Send Kudos', link: '/chat' },
    // Coach-only action for season management
    ...(userData?.role === 'Coach' || userData?.role === 'SuperAdmin' ? [{ icon: '📆', label: 'Manage Season', action: () => setShowSeasonManager(true) }] : []),
  ];

  // Format event date
  const formatEventDate = (date: any) => {
    if (!date) return { day: '--', month: '---' };
    const d = date.toDate ? date.toDate() : new Date(date);
    return {
      day: d.getDate().toString(),
      month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    };
  };

  // Get event type badge
  const getEventBadge = (type?: string) => {
    const typeMap: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'default' }> = {
      game: { label: 'Game Day', variant: 'primary' },
      practice: { label: 'Practice', variant: 'default' },
      meeting: { label: 'Meeting', variant: 'default' },
      event: { label: 'Event', variant: 'success' },
    };
    return typeMap[type?.toLowerCase() || ''] || { label: type || 'Event', variant: 'default' as const };
  };

  // Count new plays this week
  const getNewPlaysThisWeek = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return plays.filter(p => {
      const created = p.createdAt?.toDate?.() || (p.createdAt ? new Date(p.createdAt) : null);
      return created && created > weekAgo;
    }).length;
  };

  // Bulletin: Add post
  const handleAddPost = async () => {
    if (!newPost.trim() || !teamData?.id || !userData) return;
    
    // Rate limit check
    const rateLimitKey = `bulletin_${userData.uid}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.BULLETIN_POST);
    if (!rateLimitResult.allowed) {
      setRateLimitError(`Rate limit exceeded. Try again in ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds.`);
      return;
    }
    
    setAddingPost(true);
    setRateLimitError(null);
    try {
      const bulletinRef = collection(db, 'teams', teamData.id, 'bulletin');
      await addDoc(bulletinRef, {
        text: sanitizeText(newPost.trim()),
        author: userData.name || 'Unknown',
        authorId: userData.uid,
        timestamp: serverTimestamp()
      });
      setNewPost('');
    } catch (error) {
      console.error('Error adding bulletin post:', error);
    } finally {
      setAddingPost(false);
    }
  };

  // Bulletin: Edit post
  const handleEditPost = async (postId: string) => {
    if (!editingPostText.trim() || !teamData?.id) return;
    
    try {
      const postRef = doc(db, 'teams', teamData.id, 'bulletin', postId);
      await updateDoc(postRef, {
        text: sanitizeText(editingPostText.trim())
      });
      setEditingPostId(null);
      setEditingPostText('');
    } catch (error) {
      console.error('Error editing bulletin post:', error);
    }
  };

  // Bulletin: Delete post
  const handleDeletePost = async (postId: string) => {
    if (!teamData?.id) return;
    
    try {
      const postRef = doc(db, 'teams', teamData.id, 'bulletin', postId);
      await deleteDoc(postRef);
      setDeletePostConfirm(null);
    } catch (error) {
      console.error('Error deleting bulletin post:', error);
    }
  };

  // Format bulletin timestamp
  const formatBulletinDate = (timestamp: any) => {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Can edit bulletin post (author or SuperAdmin)
  const canEditPost = (post: BulletinPost) => {
    return post.authorId === userData?.uid || userData?.role === 'SuperAdmin';
  };

  // ====== TEAM RECORD HANDLERS ======
  const handleSaveRecord = async () => {
    if (!teamData?.id) return;
    setSavingRecord(true);
    try {
      const teamRef = doc(db, 'teams', teamData.id);
      await updateDoc(teamRef, {
        record: {
          wins: editRecord.wins,
          losses: editRecord.losses,
          ties: editRecord.ties
        }
      });
      setIsEditingRecord(false);
    } catch (error) {
      console.error('Error saving record:', error);
    } finally {
      setSavingRecord(false);
    }
  };

  // ====== EVENT HANDLERS ======
  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date || !teamData?.id || !userData) return;
    setAddingEvent(true);
    
    try {
      let attachments: { name: string; url: string; type: string }[] = [];
      
      // Upload attachments if any
      if (newEventAttachments.length > 0) {
        setUploadingEventFiles(true);
        for (const file of newEventAttachments) {
          const path = `teams/${teamData.id}/events/${Date.now()}_${file.name}`;
          const uploaded = await uploadFile(file, path);
          attachments.push({ name: file.name, url: uploaded.url, type: file.type });
        }
        setUploadingEventFiles(false);
      }
      
      const eventsRef = collection(db, 'teams', teamData.id, 'events');
      await addDoc(eventsRef, {
        title: sanitizeText(newEvent.title),
        eventStartDate: newEvent.date,
        eventStartTime: newEvent.time || '',
        location: sanitizeText(newEvent.location || ''),
        description: sanitizeText(newEvent.description || ''),
        eventType: newEvent.type || 'Practice',
        attachments,
        createdBy: userData.uid,
        createdAt: serverTimestamp()
      });
      
      setNewEvent({ title: '', date: '', time: '', location: '', description: '', type: 'Practice' });
      setNewEventAttachments([]);
      setShowNewEventForm(false);
    } catch (error) {
      console.error('Error adding event:', error);
    } finally {
      setAddingEvent(false);
    }
  };

  const handleEditEvent = async (eventId: string) => {
    if (!teamData?.id || !editingEvent.title) return;
    
    try {
      let attachments = selectedEvent?.attachments || [];
      
      // Upload new attachments
      if (editingEventAttachments.length > 0) {
        setUploadingEventFiles(true);
        for (const file of editingEventAttachments) {
          const path = `teams/${teamData.id}/events/${Date.now()}_${file.name}`;
          const uploaded = await uploadFile(file, path);
          attachments = [...attachments, { name: file.name, url: uploaded.url, type: file.type }];
        }
        setUploadingEventFiles(false);
      }
      
      const eventRef = doc(db, 'teams', teamData.id, 'events', eventId);
      await updateDoc(eventRef, {
        title: sanitizeText(editingEvent.title || ''),
        eventStartDate: editingEvent.date || selectedEvent?.date,
        eventStartTime: editingEvent.time || '',
        location: sanitizeText(editingEvent.location || ''),
        description: sanitizeText(editingEvent.description || ''),
        eventType: editingEvent.type || 'Practice',
        attachments
      });
      
      setEditingEventId(null);
      setEditingEvent({});
      setEditingEventAttachments([]);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error editing event:', error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventConfirm || !teamData?.id) return;
    setDeletingEvent(true);
    
    try {
      // Delete attachments from storage
      const eventToDelete = events.find(e => e.id === deleteEventConfirm.id);
      if (eventToDelete?.attachments) {
        for (const att of eventToDelete.attachments) {
          try {
            await deleteFile(att.url);
          } catch (e) {
            console.warn('Could not delete attachment:', e);
          }
        }
      }
      
      const eventRef = doc(db, 'teams', teamData.id, 'events', deleteEventConfirm.id);
      await deleteDoc(eventRef);
      setDeleteEventConfirm(null);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setDeletingEvent(false);
    }
  };

  const removeNewEventAttachment = (index: number) => {
    setNewEventAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeEditingEventAttachment = (index: number) => {
    setEditingEventAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingEventAttachment = async (eventId: string, attIndex: number) => {
    if (!teamData?.id || !selectedEvent) return;
    
    const att = selectedEvent.attachments?.[attIndex];
    if (att) {
      try {
        await deleteFile(att.url);
      } catch (e) {
        console.warn('Could not delete file:', e);
      }
    }
    
    const newAttachments = selectedEvent.attachments?.filter((_, i) => i !== attIndex) || [];
    const eventRef = doc(db, 'teams', teamData.id, 'events', eventId);
    await updateDoc(eventRef, { attachments: newAttachments });
    setSelectedEvent({ ...selectedEvent, attachments: newAttachments });
  };

  // Format event date
  const formatEventDateDisplay = (dateStr: string) => {
    if (!dateStr) return { day: '--', month: '---', full: '' };
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return {
      day: day.toString(),
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    };
  };

  // Format time to 12-hour
  const formatTime12Hour = (time24: string) => {
    if (!time24) return '';
    const [hourStr, minute] = time24.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Filter events by type
  const filteredEvents = events.filter(event => {
    if (eventFilter === 'All') return true;
    return event.eventType?.toLowerCase() === eventFilter.toLowerCase();
  });

  // Check if user is a coach for this team (can go live)
  const canGoLive = userData?.role === 'Coach' && teamData?.id;
  const hasOwnLiveStream = liveStreams.some(s => s.coachId === userData?.uid);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show onboarding for parents with players but NOT on a team yet
  if (userData?.role === 'Parent' && players.length > 0 && !teamData?.id) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={`rounded-2xl p-8 max-w-lg text-center border shadow-xl ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-purple-900/30' 
            : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'
        }`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg ${
            theme === 'dark' ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30' : 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30'
          }`}>
            <span className="text-4xl">🏆</span>
          </div>
          
          <h2 className={`text-2xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Register Your Athlete for a Team
          </h2>
          
          <p className={`mb-6 text-lg ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
            To access <span className={`font-semibold ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>Dashboard</span>, your athlete needs to be registered for a team first.
          </p>
          
          <div className={`rounded-xl p-5 mb-6 border ${
            theme === 'dark' ? 'bg-zinc-900/50 border-purple-900/30' : 'bg-white border-purple-200'
          }`}>
            <div className="flex items-start gap-3 text-left">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
              }`}>
                <Calendar className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              <div>
                <h4 className={`font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Find a Team</h4>
                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Browse upcoming events and registration opportunities to register your athlete for a team in your area.
                </p>
              </div>
            </div>
          </div>
          
          <a 
            href="#/events" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
          >
            <Calendar className="w-5 h-5" /> Browse Events & Register
          </a>
          
          <p className={`text-xs mt-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
            Dashboard will be available once your athlete joins a team
          </p>
        </div>
      </div>
    );
  }

  // Show onboarding for parents without players
  if (userData?.role === 'Parent' && players.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <GlassCard className={`max-w-2xl w-full p-8 text-center ${theme === 'light' ? 'bg-white border-slate-200 shadow-xl' : ''}`}>
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <span className="text-4xl">👋</span>
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              Welcome to OSYS!
            </h1>
            <p className={`text-lg ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Let's get started by adding your first athlete
            </p>
          </div>
          
          <div className={`p-6 rounded-xl mb-6 text-left ${
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'
          }`}>
            <h3 className={`font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Quick Start:</h3>
            <ol className={`space-y-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-500 flex-shrink-0">1.</span>
                <span>Go to your <strong>Profile</strong> page using the sidebar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-500 flex-shrink-0">2.</span>
                <span>Click <strong>"Add Athlete"</strong> in the My Athletes section</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-500 flex-shrink-0">3.</span>
                <span>Select their team and enter your athlete's information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-purple-500 flex-shrink-0">4.</span>
                <span>Start accessing team chat, videos, stats, and more!</span>
              </li>
            </ol>
          </div>
          
          <a 
            href="#/profile" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/30"
          >
            <span className="text-xl">➕</span>
            Add Your First Athlete
          </a>
        </GlassCard>
      </div>
    );
  }

  // Show onboarding for independent athletes (18+ or released) without a team
  if (isIndependentAthlete && !teamData?.id) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <GlassCard className={`max-w-2xl w-full p-8 text-center ${theme === 'light' ? 'bg-white border-slate-200 shadow-xl' : ''}`}>
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <span className="text-4xl">🏃</span>
            </div>
            <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              Welcome, Athlete!
            </h1>
            <p className={`text-lg ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              You're all set up! Now let's get you on a team.
            </p>
          </div>
          
          <div className={`p-6 rounded-xl mb-6 text-left ${
            theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'
          }`}>
            <h3 className={`font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>How to Join a Team:</h3>
            <ol className={`space-y-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
              <li className="flex items-start gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                }`}>1</span>
                <span>Find a team that's accepting players for your sport and age group</span>
              </li>
              <li className="flex items-start gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                }`}>2</span>
                <span>Complete the registration form with your information</span>
              </li>
              <li className="flex items-start gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                }`}>3</span>
                <span>Pay registration fees (in full, partial, or in person)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                }`}>4</span>
                <span>You'll be added to the <strong>Draft Pool</strong> where coaches can add you to the roster!</span>
              </li>
            </ol>
          </div>

          <div className={`p-4 rounded-xl mb-6 ${
            theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
          }`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
              💡 <strong>Tip:</strong> Ask your coach or commissioner for their team's registration link, or search for open registration events.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              href="#/events" 
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/30"
            >
              <span className="text-xl">🔍</span>
              Find Open Registrations
            </a>
            <a 
              href="#/profile" 
              className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                theme === 'dark' 
                  ? 'bg-white/10 hover:bg-white/20 text-white' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
            >
              <span className="text-xl">👤</span>
              Edit Profile
            </a>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Public Page Link Banner */}
      {teamData?.id && (
        <div className={`p-4 rounded-2xl border ${
          theme === 'dark' 
            ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30' 
            : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                🌐 Public Team Page
              </p>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg truncate ${
                theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-purple-200'
              }`}>
                <span className={`text-sm truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {getPublicUrl()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Copy Link Button */}
              <button
                onClick={copyPublicLink}
                className={`px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                }`}
                title="Copy link"
              >
                <Copy className="w-4 h-4" />
                {isPublicLinkCopied ? 'Copied!' : 'Copy'}
              </button>
              
              {/* View Public Page Button */}
              <Link
                to={`/team/${teamData.id}`}
                target="_blank"
                className={`px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
                title="View public page"
              >
                <ExternalLink className="w-4 h-4" />
                View
              </Link>
              
              {/* Share Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowShareDropdown(!showShareDropdown)}
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-2 text-sm font-medium ${
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white'
                      : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white'
                  }`}
                  title="Share to social media"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                
                {/* Share Dropdown Menu */}
                {showShareDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowShareDropdown(false)}
                    />
                    <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl z-50 overflow-hidden ${
                      theme === 'dark' ? 'bg-zinc-800 border border-white/10' : 'bg-white border border-slate-200'
                    }`}>
                      <button
                        onClick={shareToFacebook}
                        className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition ${
                          theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-lg">📘</span>
                        Facebook
                      </button>
                      <button
                        onClick={shareToTwitter}
                        className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition ${
                          theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-lg">🐦</span>
                        Twitter / X
                      </button>
                      <button
                        onClick={shareToLinkedIn}
                        className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition ${
                          theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-lg">💼</span>
                        LinkedIn
                      </button>
                      <button
                        onClick={shareViaEmail}
                        className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition ${
                          theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-lg">✉️</span>
                        Email
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Stream Banner */}
      {liveStreams.length > 0 && (
        <LiveStreamBanner
          streams={liveStreams}
          teamName={teamData?.name || 'Team'}
          onClick={() => setShowLiveStreamViewer(true)}
        />
      )}

      {/* Live Stream Viewer Modal */}
      {showLiveStreamViewer && liveStreams.length > 0 && teamData?.id && (
        <LiveStreamViewer
          streams={liveStreams}
          teamId={teamData.id}
          teamName={teamData?.name || 'Team'}
          onClose={() => setShowLiveStreamViewer(false)}
          isCoach={userData?.role === 'Coach'}
        />
      )}

      {/* Go Live Button for Coaches */}
      {canGoLive && !hasOwnLiveStream && (
        <button
          onClick={() => setShowGoLiveModal(true)}
          className={`w-full p-4 rounded-2xl border-2 border-dashed transition flex items-center justify-center gap-3 ${
            theme === 'dark'
              ? 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-400'
              : 'border-red-400 bg-red-50 hover:bg-red-100 text-red-600'
          }`}
        >
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="font-bold">Go Live</span>
          <span className={`text-sm ${theme === 'dark' ? 'text-red-400/70' : 'text-red-500'}`}>Start streaming to your team</span>
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            {getGreeting()}, {userData?.name?.split(' ')[0] || 'Coach'} 👋
          </h1>
          <p className={`mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Here's what's happening with your team.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className={theme === 'dark' ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'}>
            {sportConfig.name}{teamData?.ageGroup ? ` • ${teamData.ageGroup}` : ''}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Record Card - Clickable for coaches */}
        <div 
          className={`p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border ${theme === 'dark' ? 'border-white/10' : 'border-amber-200'} ${
            userData?.role === 'Coach' ? 'cursor-pointer hover:scale-105 transition' : ''
          }`}
          onClick={() => {
            if (userData?.role === 'Coach') {
              setEditRecord({
                wins: teamData?.record?.wins || 0,
                losses: teamData?.record?.losses || 0,
                ties: teamData?.record?.ties || 0
              });
              setIsEditingRecord(true);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-2xl mb-1">🏆</div>
            {userData?.role === 'Coach' && (
              <Edit2 className="w-4 h-4 text-amber-400 opacity-50" />
            )}
          </div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{getTeamRecord()}</div>
          <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Season Record</div>
        </div>
        
        {/* Players Card */}
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border ${theme === 'dark' ? 'border-white/10' : 'border-blue-200'}`}>
          <div className="text-2xl mb-1">👥</div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{roster.length}</div>
          <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Active Players</div>
        </div>
        
        {/* Plays Card */}
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border ${theme === 'dark' ? 'border-white/10' : 'border-purple-200'}`}>
          <div className="text-2xl mb-1">📋</div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{plays.length}</div>
          <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Plays Created</div>
          <div className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>{getNewPlaysThisWeek()} new this week</div>
        </div>
        
        {/* Events Card */}
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border ${theme === 'dark' ? 'border-white/10' : 'border-green-200'}`}>
          <div className="text-2xl mb-1">📅</div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{events.length}</div>
          <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Upcoming Events</div>
        </div>
      </div>

      {/* Draft Pool - Shows players waiting to be added to roster */}
      {teamData?.id && teamData?.sport && teamData?.ageGroup && (
        <DraftPool
          teamId={teamData.id}
          teamOwnerId={(teamData as any).ownerId || teamData.coachId || ''}
          sport={teamData.sport}
          ageGroup={teamData.ageGroup}
          registrationCloseDate={registrationCloseDate}
        />
      )}

      {/* Getting Started Checklist - show for coaches who haven't dismissed */}
      {showChecklist && userData?.role === 'Coach' && (
        <GettingStartedChecklist 
          compact 
          onDismiss={() => setShowChecklist(false)} 
        />
      )}

      {/* SEASON MANAGEMENT (Coaches Only) */}
      {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && teamData?.id && (
        <GlassCard className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">📆</div>
            <div>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Season Management</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                {teamData?.programId ? 'Managed by your program commissioner' : 'Manage registration and seasons'}
              </p>
            </div>
          </div>
          
          {/* If team belongs to a program, show program seasons */}
          {teamData?.programId && programSeasons.length > 0 ? (
            <div className="space-y-3">
              {programSeasons.map((season) => {
                const statusColors: Record<string, string> = {
                  'setup': theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-slate-200 text-slate-600',
                  'registration_open': theme === 'dark' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200',
                  'registration_closed': theme === 'dark' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-200',
                  'teams_forming': theme === 'dark' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-200',
                  'active': theme === 'dark' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-700 border border-purple-200',
                  'completed': theme === 'dark' ? 'bg-gray-600 text-gray-400' : 'bg-slate-300 text-slate-500',
                };
                const statusLabels: Record<string, string> = {
                  'setup': '⚙️ Setup',
                  'registration_open': '🟢 Registration Open',
                  'registration_closed': '🔒 Registration Closed',
                  'teams_forming': '👥 Forming Teams',
                  'active': '🏈 Season Active',
                  'completed': '✅ Completed',
                };
                
                return (
                  <div 
                    key={season.id}
                    className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        {season.name}
                      </h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[season.status] || statusColors['setup']}`}>
                        {statusLabels[season.status] || season.status}
                      </span>
                    </div>
                    
                    <div className={`grid grid-cols-2 gap-2 text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>Reg: {season.registrationOpenDate} - {season.registrationCloseDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">👥</span>
                        <span>{season.totalRegistrations || 0} registered</span>
                      </div>
                    </div>
                    
                    {season.registrationFee > 0 && (
                      <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                        Registration Fee: ${(season.registrationFee / 100).toFixed(2)}
                      </p>
                    )}
                    
                    {/* Registration Link - Show when registration is open or in setup */}
                    {(season.status === 'registration_open' || season.status === 'setup') && (
                      <div className={`mt-3 p-3 rounded-lg border ${
                        theme === 'dark' 
                          ? 'bg-purple-500/10 border-purple-500/30' 
                          : 'bg-purple-50 border-purple-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className={`w-4 h-4 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>
                            Registration Link
                          </span>
                        </div>
                        <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          Share this link with parents to register their athletes
                        </p>
                        <div className={`flex items-center gap-2 p-2 rounded-lg ${
                          theme === 'dark' ? 'bg-black/30' : 'bg-white'
                        }`}>
                          <input 
                            type="text"
                            readOnly
                            value={`${window.location.origin}/#/register/${season.id}`}
                            className={`flex-1 text-xs truncate bg-transparent border-none outline-none ${
                              theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
                            }`}
                          />
                          <button
                            onClick={() => {
                              const link = `${window.location.origin}/#/register/${season.id}`;
                              navigator.clipboard.writeText(link);
                              setCopiedSeasonLink(season.id);
                              setTimeout(() => setCopiedSeasonLink(null), 2000);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                              copiedSeasonLink === season.id
                                ? 'bg-green-500 text-white'
                                : theme === 'dark'
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                  : 'bg-purple-500 hover:bg-purple-600 text-white'
                            }`}
                          >
                            {copiedSeasonLink === season.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Create Flyer Prompt */}
                    <button
                      onClick={() => {
                        // Build registration link
                        const registrationLink = `${window.location.origin}/#/register/${season.id}`;
                        
                        navigate('/design', { 
                          state: { 
                            registrationData: {
                              seasonId: season.id,
                              seasonName: season.name,
                              teamName: teamData.name,
                              sport: teamData.sport,
                              registrationFee: season.registrationFee,
                              registrationOpenDate: season.registrationOpenDate,
                              registrationCloseDate: season.registrationCloseDate,
                              ageGroup: teamData.ageGroup,
                              registrationLink,
                            }
                          } 
                        });
                      }}
                      className={`mt-3 p-3 rounded-lg border-2 border-dashed w-full text-left transition-all hover:scale-[1.01] ${
                        theme === 'dark' 
                          ? 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50 hover:bg-orange-500/10' 
                          : 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Palette className="w-5 h-5 text-orange-500" />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                            🎨 Create Registration Flyer
                          </p>
                          <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            Design a flyer to share with parents - season info pre-loaded
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-orange-500" />
                      </div>
                    </button>
                  </div>
                );
              })}
              
              <p className={`text-xs text-center ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`}>
                Seasons are managed by {teamData.programName || 'your program commissioner'}
              </p>
            </div>
          ) : teamData?.programId && loadingProgramSeasons ? (
            <div className={`text-center py-6 ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
              Loading seasons...
            </div>
          ) : teamData?.programId ? (
            <div className={`text-center py-6 ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
              <p>No seasons created yet by your program.</p>
              <p className="text-xs mt-1">Contact your commissioner to set up the season.</p>
            </div>
          ) : (
            /* Team manages their own seasons */
            <SeasonManager
              teamId={teamData.id}
              teamName={teamData.name}
              sport={teamData.sport || 'football'}
              ageGroup={teamData.ageGroup}
              currentSeasonId={teamData.currentSeasonId}
              rosterCount={roster.length}
              leagueId={teamData.leagueId}
              leagueStatus={teamData.leagueStatus}
              leagueName={teamData.leagueName}
              onNavigateToDesignStudio={(data?: RegistrationFlyerData) => {
                if (data) {
                  // Navigate with season data to prefill registration template
                  navigate('/design', { state: { registrationData: data } });
                } else {
                  navigate('/design');
                }
              }}
            />
          )}
        </GlassCard>
      )}

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <GlassCard className={`lg:col-span-1 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              <span>📅</span> Upcoming
            </h2>
            <div className="flex items-center gap-2">
              {userData?.role === 'Coach' && (
                <button
                  onClick={() => setShowNewEventForm(true)}
                  className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <Link to="/events" className="text-purple-500 text-sm hover:text-purple-400 transition">
                View All →
              </Link>
            </div>
          </div>
          
          {/* Event Filter Tabs */}
          {userData?.role === 'Coach' && (
            <div className="flex gap-1 mb-3">
              {(['All', 'Practice', 'Game'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setEventFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-lg transition ${
                    eventFilter === filter
                      ? 'bg-purple-600 text-white'
                      : theme === 'dark' ? 'bg-white/10 text-slate-400 hover:bg-white/20' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
          
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <p className={`text-center py-4 italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No upcoming events</p>
            ) : (
              filteredEvents.slice(0, 3).map((event) => {
                const date = formatEventDate(event.eventStartDate);
                const badge = getEventBadge(event.eventType);
                return (
                  <div 
                    key={event.id} 
                    onClick={() => setSelectedEvent(event as EventWithAttachments)}
                    className={`flex items-center gap-4 p-3 rounded-xl transition cursor-pointer ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'}`}
                  >
                    <div className="text-center min-w-[50px]">
                      <div className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{date.day}</div>
                      <div className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>{date.month}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{event.title}</div>
                      <div className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        {event.location && `📍 ${event.location}`}
                        {event.eventStartTime && ` • ${event.eventStartTime}`}
                      </div>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <GlassCard className={`lg:col-span-1 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}`}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            <span>⚡</span> Quick Actions
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action, i) => {
              // If action has a callback function, render as button
              if ('action' in action && action.action) {
                return (
                  <button
                    key={i}
                    onClick={action.action}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-xl transition
                      ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'} hover:scale-105
                    `}
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{action.label}</span>
                  </button>
                );
              }
              // Otherwise render as Link
              return (
                <Link
                  key={i}
                  to={action.link || '#'}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl transition
                    ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'} hover:scale-105
                  `}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{action.label}</span>
                </Link>
              );
            })}
          </div>
        </GlassCard>

        {/* Roster Preview */}
        <GlassCard className={`lg:col-span-1 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              <span>👥</span> Roster
            </h2>
            <Link to="/roster" className="text-purple-500 text-sm hover:text-purple-400 transition">
              View All →
            </Link>
          </div>
          <div className="space-y-2">
            {roster.slice(0, 5).map((player) => (
              <div 
                key={player.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
              >
                <Avatar name={player.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{player.name}</div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    #{player.jerseyNumber || '--'} • {player.position || 'No position'}
                  </div>
                </div>
              </div>
            ))}
            {roster.length === 0 && (
              <p className={`text-center py-4 italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No players yet</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Coaching Staff & Bulletin Board Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Coaching Staff */}
        <GlassCard className={theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            <span>👨‍🏫</span> Coaching Staff
          </h2>
          {coachesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : coaches.length === 0 ? (
            <p className={`text-center py-4 italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No coaches assigned</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {coaches.map((coach) => (
                <Link
                  key={coach.uid}
                  to={coach.username ? `/coach/${coach.username}` : '#'}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition ${
                    theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {/* Coach Photo */}
                  {coach.photoUrl ? (
                    <img 
                      src={coach.photoUrl} 
                      alt={coach.name} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/50"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                    }`}>
                      {coach.name?.charAt(0) || '?'}
                    </div>
                  )}
                  {/* Coach Name */}
                  <span className={`text-sm font-medium text-center truncate w-full ${
                    theme === 'dark' ? 'text-white' : 'text-zinc-900'
                  }`}>
                    {coach.name || 'Unknown'}
                  </span>
                  {/* Role Badges */}
                  <div className="flex flex-wrap gap-1 justify-center">
                    {coach.isHeadCoach && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                        theme === 'dark' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-300'
                      }`}>
                        HC
                      </span>
                    )}
                    {coach.isOC && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                        theme === 'dark' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300'
                      }`}>
                        OC
                      </span>
                    )}
                    {coach.isDC && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                        theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-300'
                      }`}>
                        DC
                      </span>
                    )}
                    {coach.isSTC && (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                        theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      }`}>
                        STC
                      </span>
                    )}
                    {!coach.isHeadCoach && !coach.isOC && !coach.isDC && !coach.isSTC && (
                      <span className={`px-2 py-0.5 text-[10px] rounded ${
                        theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600'
                      }`}>
                        Coach
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Bulletin Board */}
        <GlassCard className={theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}>
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
            <span>📌</span> Bulletin Board
          </h2>
          
          {/* Add Post Form (Coach/SuperAdmin only) */}
          {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin') && (
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Post an announcement..."
                  maxLength={500}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    theme === 'dark'
                      ? 'bg-white/10 border border-white/20 text-white placeholder:text-slate-400'
                      : 'bg-slate-100 border border-slate-300 text-zinc-900 placeholder:text-slate-500'
                  } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddPost();
                    }
                  }}
                />
                <button
                  onClick={handleAddPost}
                  disabled={addingPost || !newPost.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition"
                >
                  {addingPost ? '...' : 'Post'}
                </button>
              </div>
              {rateLimitError && (
                <p className="text-red-400 text-xs mt-1">{rateLimitError}</p>
              )}
            </div>
          )}

          {/* Posts List */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {posts.length === 0 ? (
              <p className={`text-center py-4 italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                No announcements yet
              </p>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className={`p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'
                  }`}
                >
                  {editingPostId === post.id ? (
                    /* Edit Mode */
                    <div className="space-y-2">
                      <textarea
                        value={editingPostText}
                        onChange={(e) => setEditingPostText(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg text-sm ${
                          theme === 'dark'
                            ? 'bg-white/10 border border-white/20 text-white'
                            : 'bg-white border border-slate-300 text-zinc-900'
                        } focus:outline-none focus:ring-2 focus:ring-purple-500`}
                        rows={3}
                        maxLength={500}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditingPostId(null); setEditingPostText(''); }}
                          className={`px-3 py-1 text-xs rounded ${
                            theme === 'dark' ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditPost(post.id)}
                          className="px-3 py-1 text-xs rounded bg-purple-600 text-white"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : deletePostConfirm === post.id ? (
                    /* Delete Confirmation */
                    <div className="text-center space-y-2">
                      <p className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                        Delete this post?
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setDeletePostConfirm(null)}
                          className={`px-3 py-1 text-xs rounded ${
                            theme === 'dark' ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="px-3 py-1 text-xs rounded bg-red-600 text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal View */
                    <div>
                      <div 
                        className={`text-sm cursor-pointer ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}
                        onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                      >
                        {expandedPostId === post.id || post.text.length <= 100
                          ? post.text
                          : `${post.text.slice(0, 100)}...`}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {post.author} • {formatBulletinDate(post.timestamp)}
                        </span>
                        {canEditPost(post) && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingPostId(post.id); setEditingPostText(post.text); }}
                              className={`text-xs px-2 py-0.5 rounded ${
                                theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                              }`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletePostConfirm(post.id)}
                              className={`text-xs px-2 py-0.5 rounded ${
                                theme === 'dark' ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-red-500 hover:text-red-700 hover:bg-red-100'
                              }`}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>



      {/* ====== MODALS ====== */}

      {/* Edit Record Modal */}
      {isEditingRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsEditingRecord(false)}>
          <div 
            className={`w-full max-w-md rounded-2xl p-6 ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white border border-slate-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Edit Team Record</h3>
              <button onClick={() => setIsEditingRecord(false)} className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Wins</label>
                <input
                  type="number"
                  min="0"
                  value={editRecord.wins}
                  onChange={e => setEditRecord(prev => ({ ...prev, wins: parseInt(e.target.value) || 0 }))}
                  className={`w-full px-3 py-2 rounded-lg text-center text-2xl font-bold ${
                    theme === 'dark' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Losses</label>
                <input
                  type="number"
                  min="0"
                  value={editRecord.losses}
                  onChange={e => setEditRecord(prev => ({ ...prev, losses: parseInt(e.target.value) || 0 }))}
                  className={`w-full px-3 py-2 rounded-lg text-center text-2xl font-bold ${
                    theme === 'dark' ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Ties</label>
                <input
                  type="number"
                  min="0"
                  value={editRecord.ties}
                  onChange={e => setEditRecord(prev => ({ ...prev, ties: parseInt(e.target.value) || 0 }))}
                  className={`w-full px-3 py-2 rounded-lg text-center text-2xl font-bold ${
                    theme === 'dark' ? 'bg-slate-500/20 border border-slate-500/30 text-slate-400' : 'bg-slate-100 border border-slate-200 text-slate-700'
                  }`}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditingRecord(false)}
                className={`flex-1 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecord}
                disabled={savingRecord}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                {savingRecord ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Event Modal */}
      {showNewEventForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowNewEventForm(false); setNewEventAttachments([]); }}>
          <div 
            className={`w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white border border-slate-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Add New Event</h3>
              <button onClick={() => { setShowNewEventForm(false); setNewEventAttachments([]); }} className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Title *</label>
                <input
                  type="text"
                  value={newEvent.title || ''}
                  onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Practice at Main Field"
                  className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Date *</label>
                  <input
                    type="date"
                    value={newEvent.date || ''}
                    onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Time</label>
                  <input
                    type="time"
                    value={newEvent.time || ''}
                    onChange={e => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                  />
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Type</label>
                <select
                  value={newEvent.type || 'Practice'}
                  onChange={e => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                >
                  <option value="Practice">Practice</option>
                  <option value="Game">Game</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Location</label>
                <input
                  type="text"
                  value={newEvent.location || ''}
                  onChange={e => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Main Field, Gym"
                  className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Description</label>
                <textarea
                  value={newEvent.description || ''}
                  onChange={e => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Additional details..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                />
              </div>
              
              {/* Attachments */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Attachments</label>
                <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer ${
                  theme === 'dark' ? 'border-white/20 hover:border-white/40' : 'border-slate-300 hover:border-slate-400'
                }`}>
                  <Paperclip className="w-4 h-4" />
                  <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Add files (images, PDFs)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      setNewEventAttachments(prev => [...prev, ...files].slice(0, 5));
                    }}
                  />
                </label>
                {newEventAttachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {newEventAttachments.map((file, i) => (
                      <div key={i} className={`flex items-center justify-between p-2 rounded ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <span className={`text-sm truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{file.name}</span>
                        <button onClick={() => removeNewEventAttachment(i)} className="text-red-400 hover:text-red-300">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowNewEventForm(false); setNewEventAttachments([]); }}
                className={`flex-1 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                disabled={addingEvent || !newEvent.title || !newEvent.date}
                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                {uploadingEventFiles ? 'Uploading...' : addingEvent ? 'Adding...' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setSelectedEvent(null); setEditingEventId(null); }}>
          <div 
            className={`w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white border border-slate-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                {editingEventId === selectedEvent.id ? 'Edit Event' : 'Event Details'}
              </h3>
              <button onClick={() => { setSelectedEvent(null); setEditingEventId(null); }} className={theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {editingEventId === selectedEvent.id ? (
              /* Edit Mode */
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Title</label>
                  <input
                    type="text"
                    value={editingEvent.title ?? selectedEvent.title}
                    onChange={e => setEditingEvent(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Date</label>
                    <input
                      type="date"
                      value={editingEvent.date ?? selectedEvent.date ?? selectedEvent.eventStartDate}
                      onChange={e => setEditingEvent(prev => ({ ...prev, date: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Time</label>
                    <input
                      type="time"
                      value={editingEvent.time ?? selectedEvent.time ?? selectedEvent.eventStartTime ?? ''}
                      onChange={e => setEditingEvent(prev => ({ ...prev, time: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Type</label>
                  <select
                    value={editingEvent.type ?? selectedEvent.type ?? selectedEvent.eventType ?? 'Practice'}
                    onChange={e => setEditingEvent(prev => ({ ...prev, type: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                  >
                    <option value="Practice">Practice</option>
                    <option value="Game">Game</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Location</label>
                  <input
                    type="text"
                    value={editingEvent.location ?? selectedEvent.location ?? ''}
                    onChange={e => setEditingEvent(prev => ({ ...prev, location: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Description</label>
                  <textarea
                    value={editingEvent.description ?? selectedEvent.description ?? ''}
                    onChange={e => setEditingEvent(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className={`w-full px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 border border-white/20 text-white' : 'bg-slate-100 border border-slate-300 text-zinc-900'}`}
                  />
                </div>
                
                {/* Existing Attachments */}
                {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Existing Attachments</label>
                    <div className="space-y-1">
                      {selectedEvent.attachments.map((att, i) => (
                        <div key={i} className={`flex items-center justify-between p-2 rounded ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                          <span className={`text-sm truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{att.name}</span>
                          <button onClick={() => removeExistingEventAttachment(selectedEvent.id, i)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Add New Attachments */}
                <div>
                  <label className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer ${
                    theme === 'dark' ? 'border-white/20 hover:border-white/40' : 'border-slate-300 hover:border-slate-400'
                  }`}>
                    <Paperclip className="w-4 h-4" />
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>Add more files</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        setEditingEventAttachments(prev => [...prev, ...files].slice(0, 5));
                      }}
                    />
                  </label>
                  {editingEventAttachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {editingEventAttachments.map((file, i) => (
                        <div key={i} className={`flex items-center justify-between p-2 rounded ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                          <span className={`text-sm truncate ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{file.name}</span>
                          <button onClick={() => removeEditingEventAttachment(i)} className="text-red-400 hover:text-red-300">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => { setEditingEventId(null); setEditingEvent({}); setEditingEventAttachments([]); }}
                    className={`flex-1 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-700'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEditEvent(selectedEvent.id)}
                    disabled={uploadingEventFiles}
                    className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                  >
                    {uploadingEventFiles ? 'Uploading...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant={selectedEvent.eventType?.toLowerCase() === 'game' ? 'primary' : 'default'}>
                    {selectedEvent.eventType || selectedEvent.type || 'Event'}
                  </Badge>
                  <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{selectedEvent.title}</h4>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                      {formatEventDateDisplay(selectedEvent.date || selectedEvent.eventStartDate || '').full}
                    </span>
                  </div>
                  {(selectedEvent.time || selectedEvent.eventStartTime) && (
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                      <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>
                        {formatTime12Hour(selectedEvent.time || selectedEvent.eventStartTime || '')}
                      </span>
                    </div>
                  )}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                      <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{selectedEvent.location}</span>
                    </div>
                  )}
                </div>
                
                {selectedEvent.description && (
                  <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                    <p className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{selectedEvent.description}</p>
                  </div>
                )}
                
                {/* Attachments */}
                {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                  <div>
                    <h5 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Attachments</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedEvent.attachments.map((att, i) => (
                        <div key={i}>
                          {att.type?.startsWith('image/') ? (
                            <img 
                              src={att.url} 
                              alt={att.name}
                              className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80"
                              onClick={() => setLightboxImage({ url: att.url, name: att.name })}
                            />
                          ) : (
                            <a 
                              href={att.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'}`}
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="text-sm truncate">{att.name}</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions for Coaches */}
                {userData?.role === 'Coach' && (
                  <div className="flex gap-3 pt-4 border-t border-white/10">
                    <button
                      onClick={() => {
                        setEditingEventId(selectedEvent.id);
                        setEditingEvent({
                          title: selectedEvent.title,
                          date: selectedEvent.date || selectedEvent.eventStartDate,
                          time: selectedEvent.time || selectedEvent.eventStartTime,
                          type: selectedEvent.type || selectedEvent.eventType,
                          location: selectedEvent.location,
                          description: selectedEvent.description
                        });
                      }}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${
                        theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteEventConfirm({ id: selectedEvent.id, title: selectedEvent.title })}
                      className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Event Confirmation */}
      {deleteEventConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteEventConfirm(null)}>
          <div 
            className={`w-full max-w-sm rounded-2xl p-6 ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white border border-slate-200'}`}
            onClick={e => e.stopPropagation()}
          >
            <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Delete Event?</h3>
            <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Are you sure you want to delete "<strong>{deleteEventConfirm.title}</strong>"? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteEventConfirm(null)}
                className={`flex-1 py-2 rounded-lg ${theme === 'dark' ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={deletingEvent}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {deletingEvent ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-white hover:text-slate-300"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={lightboxImage.url} 
            alt={lightboxImage.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* Go Live Modal */}
      {showGoLiveModal && teamData?.id && (
        <GoLiveModal
          teamId={teamData.id}
          teamName={teamData?.name || 'Team'}
          onClose={() => setShowGoLiveModal(false)}
        />
      )}

      {/* Save Stream to Library Modal */}
      {endedStream && teamData?.id && (
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

// Wrap with NoAthleteBlock for parents/athletes without a team
const WrappedNewOSYSDashboard: React.FC = () => {
  return (
    <NoAthleteBlock featureName="Dashboard">
      <NewOSYSDashboard />
    </NoAthleteBlock>
  );
};

export default WrappedNewOSYSDashboard;
