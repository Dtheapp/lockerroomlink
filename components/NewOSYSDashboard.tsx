import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getStats, getSportConfig } from '../config/sportConfig';
import {
  GlassCard,
  Badge,
  Avatar,
} from './ui/OSYSComponents';
import { LiveStreamBanner, LiveStreamViewer } from './livestream';
import { checkRateLimit, RATE_LIMITS } from '../services/rateLimit';
import { sanitizeText } from '../services/sanitize';
import type { LiveStream, BulletinPost, UserProfile } from '../types';

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
  const [roster, setRoster] = useState<PlayerData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [plays, setPlays] = useState<PlayData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Copy states
  const [isCopied, setIsCopied] = useState(false);
  const [isPublicLinkCopied, setIsPublicLinkCopied] = useState(false);
  
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

  // Quick actions based on sport
  const quickActions = [
    { icon: '📋', label: 'New Play', link: '/playbook' },
    { icon: '📺', label: 'Go Live', link: '/videos', comingSoon: true },
    { icon: '📢', label: 'Announce', link: '/chat' },
    { icon: '📊', label: 'Log Stats', link: '/stats' },
    { icon: '💰', label: 'Fundraise', link: '/fundraising', comingSoon: true },
    { icon: '💫', label: 'Send Kudos', link: '/chat' },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="space-y-6">
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
            {sportConfig.name}
          </Badge>
          {/* Copy Team ID */}
          <button
            onClick={copyTeamId}
            className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              theme === 'dark'
                ? 'bg-white/10 hover:bg-white/20 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            {isCopied ? '✓ Copied!' : '📋 Team ID'}
          </button>
          {/* Copy Public Link */}
          <button
            onClick={copyPublicLink}
            className={`text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              theme === 'dark'
                ? 'bg-white/10 hover:bg-white/20 text-slate-300'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            {isPublicLinkCopied ? '✓ Copied!' : '🔗 Share'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Record Card */}
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border ${theme === 'dark' ? 'border-white/10' : 'border-amber-200'}`}>
          <div className="text-2xl mb-1">🏆</div>
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

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <GlassCard className={`lg:col-span-1 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
              <span>📅</span> Upcoming
            </h2>
            <Link to="/events" className="text-purple-500 text-sm hover:text-purple-400 transition">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No upcoming events</p>
            ) : (
              events.slice(0, 3).map((event) => {
                const date = formatEventDate(event.eventStartDate);
                const badge = getEventBadge(event.eventType);
                return (
                  <Link 
                    key={event.id} 
                    to={`/events/${event.id}`}
                    className={`flex items-center gap-4 p-3 rounded-xl transition ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'}`}
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
                  </Link>
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
            {quickActions.map((action, i) => (
              <Link
                key={i}
                to={action.comingSoon ? '#' : action.link}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-xl transition
                  ${action.comingSoon 
                    ? `${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'} opacity-50 cursor-not-allowed` 
                    : `${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'} hover:scale-105`
                  }
                `}
                onClick={e => action.comingSoon && e.preventDefault()}
              >
                <span className="text-2xl">{action.icon}</span>
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{action.label}</span>
                {action.comingSoon && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-300 text-slate-600'}`}>SOON</span>
                )}
              </Link>
            ))}
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
              <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No players yet</p>
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
            <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No coaches assigned</p>
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
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        HC
                      </span>
                    )}
                    {coach.isOC && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        OC
                      </span>
                    )}
                    {coach.isDC && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        DC
                      </span>
                    )}
                    {coach.isSTC && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
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
              <p className={`text-center py-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
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
                        <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
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

      {/* Sport Info Banner */}
      <GlassCard className={`${theme === 'dark' ? 'bg-gradient-to-r from-purple-900/50 to-pink-900/50' : 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200'}`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{sportConfig.emoji}</div>
            <div>
              <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{teamData?.name || 'Your Team'}</h3>
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>{sportConfig.name} • {roster.length} players • {plays.length} plays</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/roster" className={`px-4 py-2 rounded-lg transition text-sm ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-zinc-900'}`}>
              Manage Roster
            </Link>
            <Link to="/playbook" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition text-sm text-white">
              Open Playbook
            </Link>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default NewOSYSDashboard;
