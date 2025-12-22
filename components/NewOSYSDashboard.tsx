import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, getDoc, onSnapshot, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import NoAthleteBlock from './NoAthleteBlock';
import { getStats, getSportConfig } from '../config/sportConfig';
import { uploadFile, deleteFile } from '../services/storage';
import { toastSuccess, toastError } from '../services/toast';
import { createNotification, createBulkNotifications } from '../services/notificationService';
import { getPlayerRegistrationStatus, type PlayerRegistrationStatus } from '../services/eventService';
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
import GameDayHub from './GameDayHub';
import type { LiveStream, BulletinPost, UserProfile, ProgramSeason, TeamGame } from '../types';
import { Plus, X, Calendar, MapPin, Clock, Edit2, Trash2, Paperclip, Image, Copy, ExternalLink, Share2, Link2, Check, Palette, ChevronRight, ChevronDown, Trophy, AlertTriangle, Loader2, UserPlus, Users, Sword, Shield, Zap, Crown } from 'lucide-react';

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
  const { teamData, userData, players, selectedSportContext, selectedPlayer } = useAuth();
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

  // All scheduled games for Game Day Hub
  const [allGames, setAllGames] = useState<TeamGame[]>([]);
  const [loadingProgramSeasons, setLoadingProgramSeasons] = useState(false);
  const [copiedSeasonLink, setCopiedSeasonLink] = useState<string | null>(null);
  const [showCompletedSeasons, setShowCompletedSeasons] = useState(false);
  const [seasonManagerCollapsed, setSeasonManagerCollapsed] = useState(true); // Collapsed by default
  
  // Draft pool state for coach dashboard
  const [draftPoolPlayers, setDraftPoolPlayers] = useState<any[]>([]);
  const [loadingDraftPool, setLoadingDraftPool] = useState(false);
  
  // Draft player modal state
  const [draftModalPlayer, setDraftModalPlayer] = useState<any | null>(null);
  const [draftingPlayer, setDraftingPlayer] = useState(false);
  
  // Decline player modal state
  const [declineModalPlayer, setDeclineModalPlayer] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningPlayer, setDecliningPlayer] = useState(false);

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
        const rosterPlayers = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerData));
        
        // Enrich with photos from global athlete profiles
        const enrichedPlayers = await Promise.all(
          rosterPlayers.map(async (player) => {
            // If player already has photoUrl, use it
            if (player.photoUrl) return player;
            
            // Try to fetch from global athletes collection
            if (player.athleteId) {
              try {
                const athleteDoc = await getDoc(doc(db, 'players', player.athleteId));
                if (athleteDoc.exists()) {
                  const athleteData = athleteDoc.data();
                  return {
                    ...player,
                    photoUrl: athleteData.photoUrl || player.photoUrl,
                  };
                }
              } catch (err) {
                console.error('Error fetching athlete photo:', err);
              }
            }
            return player;
          })
        );
        
        setRoster(enrichedPlayers);

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

    // Real-time events listener - read from global events collection filtered by teamId
    const eventsRef = collection(db, 'events');
    const eventsQuery = query(
      eventsRef, 
      where('teamId', '==', teamData.id),
      orderBy('eventStartDate', 'asc'), 
      limit(10)
    );
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Extract location - handle both object and string formats
        const locationValue = typeof data.location === 'object' 
          ? (data.location?.name || data.location?.address || '') 
          : (data.location || '');
        return { 
          ...data, // Spread first so our explicit fields take precedence
          id: doc.id, 
          title: data.title || '',
          eventType: data.type || data.eventType || 'event', // Handle both field names
          eventStartDate: data.eventStartDate,
          eventStartTime: data.eventStartTime || data.startTime || '',
          location: locationValue,
          description: data.description || '',
        } as EventData;
      });
      // Filter to only future events (including today)
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const futureEvents = eventsData.filter(event => {
        if (!event.eventStartDate) return false;
        const eventDate = event.eventStartDate?.toDate?.() || new Date(event.eventStartDate);
        return eventDate >= startOfToday;
      });
      setEvents(futureEvents);
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

  // Fetch ALL games from PROGRAM SEASON GAMES (single source of truth)
  useEffect(() => {
    if (!teamData?.id || !teamData?.programId) {
      setAllGames([]);
      return;
    }

    // Find the active season for this team's program
    const activeSeason = programSeasons.find(s => s.status === 'active') || 
                         programSeasons.find(s => s.status !== 'completed') ||
                         programSeasons[0];
    
    if (!activeSeason) {
      console.log('[GameDayHub] No active season found');
      setAllGames([]);
      return;
    }

    console.log('[GameDayHub] Loading games from program season:', teamData.programId, '/', activeSeason.id);

    // SINGLE SOURCE: Listen to programs/{programId}/seasons/{seasonId}/games
    const gamesRef = collection(db, 'programs', teamData.programId, 'seasons', activeSeason.id, 'games');
    const unsubscribeGames = onSnapshot(gamesRef, (snapshot) => {
      const games: TeamGame[] = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        
        // Only include games where THIS team is home or away
        if (data.homeTeamId !== teamData.id && data.awayTeamId !== teamData.id) {
          return;
        }
        
        // Determine if this team is home or away
        const isHome = data.homeTeamId === teamData.id;
        const opponent = isHome ? data.awayTeamName : data.homeTeamName;
        
        // Parse game date
        let scheduledDate = data.weekDate;
        if (typeof scheduledDate === 'string') {
          // Convert string date to Timestamp-like object for consistency
          const parts = scheduledDate.split('-');
          if (parts.length === 3) {
            scheduledDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        }
        
        games.push({
          id: docSnap.id,
          teamId: teamData.id,
          programGameId: docSnap.id, // Reference to this game
          programId: teamData.programId,
          seasonId: activeSeason.id,
          source: 'program', // Indicates this comes from program schedule
          opponent: opponent || 'TBD',
          isHome: isHome,
          week: data.week,
          scheduledDate: scheduledDate,
          scheduledTime: data.time || '',
          location: data.location || '',
          homeScore: data.homeScore || 0,
          awayScore: data.awayScore || 0,
          status: data.status || 'scheduled',
          homeTeamId: data.homeTeamId,
          homeTeamName: data.homeTeamName,
          awayTeamId: data.awayTeamId,
          awayTeamName: data.awayTeamName,
          stats: data.stats,
          createdAt: data.createdAt,
        } as TeamGame);
      });
      
      // Sort: live first, then by week number (ascending for upcoming games)
      games.sort((a, b) => {
        // Priority: live > scheduled > completed
        const statusPriority = (status?: string) => {
          if (status === 'live') return 0;
          if (status === 'completed') return 2;
          return 1;
        };
        const aPriority = statusPriority(a.status);
        const bPriority = statusPriority(b.status);
        if (aPriority !== bPriority) return aPriority - bPriority;
        
        // For scheduled games, sort by week ascending (upcoming first)
        // For completed games, sort by week descending (most recent first)
        if (a.status === 'completed' && b.status === 'completed') {
          return (b.week || 0) - (a.week || 0);
        }
        return (a.week || 0) - (b.week || 0);
      });
      
      console.log('[GameDayHub] Loaded', games.length, 'games for team', teamData.id);
      setAllGames(games);
    }, (error) => {
      console.error('Error fetching program games:', error);
      setAllGames([]);
    });

    return () => {
      unsubscribeGames();
    };
  }, [teamData?.id, teamData?.programId, programSeasons]);

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

  // Fetch draft pool players for coach view
  useEffect(() => {
    const loadDraftPool = async () => {
      const programId = teamData?.programId;
      if (!programId) {
        setDraftPoolPlayers([]);
        return;
      }
      
      const teamAgeGroups = teamData?.ageGroups || (teamData?.ageGroup ? [teamData.ageGroup] : []);
      console.log('🔍 Draft Pool Load:', { programId, teamAgeGroups, programSeasonsCount: programSeasons.length });
      
      if (programSeasons.length === 0) {
        return; // Wait for program seasons to load
      }
      
      setLoadingDraftPool(true);
      try {
        const allPlayers: any[] = [];
        
        for (const season of programSeasons) {
          console.log('📅 Season found:', season.id, season.name, 'status:', season.status);
          
          // Check if this age group's draft is still active using the new flag
          const ageGroupsDraftActive = (season as any).ageGroupsDraftActive || {};
          const teamHasActiveDraft = teamAgeGroups.some(ag => {
            // Check exact match or partial match for range age groups
            if (ageGroupsDraftActive[ag] === true) return true;
            // Also check if any key contains our age group (for range matching)
            return Object.keys(ageGroupsDraftActive).some(key => 
              ageGroupsDraftActive[key] === true && (key.includes(ag) || ag.includes(key))
            );
          });
          
          console.log('🎯 Team draft active check:', { teamAgeGroups, ageGroupsDraftActive, teamHasActiveDraft });
          
          // Only skip if explicitly set to false for ALL team age groups
          // (For backwards compatibility, if ageGroupsDraftActive is empty, still show)
          if (Object.keys(ageGroupsDraftActive).length > 0 && !teamHasActiveDraft) {
            console.log('⏭️ Skipping season - draft complete for team age groups');
            continue;
          }
          
          // Query draft pool for this season
          const draftPoolRef = collection(db, 'programs', programId, 'seasons', season.id, 'draftPool');
          const draftPoolSnap = await getDocs(draftPoolRef);
          
          console.log('🏊 Draft pool for season', season.id, ':', draftPoolSnap.docs.length, 'players');
          
          draftPoolSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            
            // Skip already drafted or declined players
            if (data.status === 'drafted' || data.status === 'declined') {
              console.log('⏭️ Skipping player (status:', data.status, '):', data.athleteFirstName, data.athleteLastName);
              return;
            }
            
            const playerAgeGroup = data.ageGroupName || data.ageGroup || '';
            
            // Filter by team's age group(s)
            const matchesTeamAgeGroup = teamAgeGroups.some(teamAg => {
              // Exact match
              if (playerAgeGroup === teamAg) return true;
              
              // Range match: "11U-12U" matches team "11U" or "12U"
              // Also: team "11U-12U" matches player "11U" or "12U"
              const playerParts = playerAgeGroup.split('-').map(p => p.trim().toUpperCase());
              const teamParts = teamAg.split('-').map(p => p.trim().toUpperCase());
              
              // Check if any part matches
              return playerParts.some(pp => teamParts.includes(pp)) || 
                     teamParts.some(tp => playerParts.includes(tp));
            });
            
            console.log('👤 Player:', data.athleteFirstName, data.athleteLastName, 'ageGroup:', playerAgeGroup, 'matches:', matchesTeamAgeGroup, 'teamAgeGroups:', teamAgeGroups);
            
            // Only add players that match team's age group
            if (matchesTeamAgeGroup) {
              allPlayers.push({
                id: docSnap.id,
                ...data,
                seasonId: season.id,
                seasonName: season.name
              });
            }
          });
        }
        
        console.log('📋 Total draft pool players (filtered):', allPlayers.length);
        setDraftPoolPlayers(allPlayers);
      } catch (error) {
        console.error('Error loading draft pool:', error);
      } finally {
        setLoadingDraftPool(false);
      }
    };
    
    loadDraftPool();
  }, [teamData?.programId, teamData?.ageGroup, teamData?.ageGroups, programSeasons]);

  // Check if registration is still open (to disable Draft button)
  // Draft is only available when season status is 'active' (started)
  const isRegistrationOpen = React.useMemo(() => {
    // Check if any season is still in registration phase (not yet started)
    return programSeasons.some(season => {
      // If status is explicitly 'active' or 'completed', registration is closed
      if (season.status === 'active' || season.status === 'completed') {
        return false;
      }
      // Otherwise, registration is still open (status is 'registration_open', 'setup', etc.)
      return true;
    });
  }, [programSeasons]);

  // Handle declining a player from draft pool
  const handleDeclinePlayer = async () => {
    if (!declineModalPlayer || !declineReason.trim()) {
      toastError('Please enter a reason for declining');
      return;
    }
    
    setDecliningPlayer(true);
    try {
      const programId = teamData?.programId;
      if (!programId) throw new Error('No program ID');
      
      const player = declineModalPlayer;
      const seasonId = player.seasonId;
      
      // 1. Delete from draft pool
      await deleteDoc(doc(db, 'programs', programId, 'seasons', seasonId, 'draftPool', player.id));
      
      // 2. Update player document with declined status (if athleteId exists)
      if (player.athleteId) {
        try {
          await updateDoc(doc(db, 'players', player.athleteId), {
            draftPoolStatus: 'declined',
            draftPoolDeclinedReason: declineReason,
            draftPoolDeclinedBy: userData?.name || 'Coach',
            draftPoolDeclinedAt: serverTimestamp(),
            // Clear the active draft pool references
            draftPoolProgramId: deleteField(),
            draftPoolSeasonId: deleteField(),
            draftPoolEntryId: deleteField(),
            draftPoolAgeGroup: deleteField(),
            draftPoolUpdatedAt: serverTimestamp(),
          });
          console.log('✅ Updated player document with declined status');
        } catch (err) {
          console.error('⚠️ Failed to update player document (non-fatal):', err);
        }
      }
      
      // 3. Create notification for parent (TOP-LEVEL notifications collection!)
      if (player.parentUserId) {
        await addDoc(collection(db, 'notifications'), {
          userId: player.parentUserId, // Required: identifies who the notification is for
          type: 'registration_declined',
          title: '❌ Registration Declined',
          message: `${player.athleteFirstName} ${player.athleteLastName}'s registration has been declined. Reason: ${declineReason}`,
          category: 'registration',
          priority: 'high',
          read: false,
          link: '/dashboard',
          metadata: {
            athleteName: `${player.athleteFirstName} ${player.athleteLastName}`,
            teamName: teamData?.name || 'Team',
            reason: declineReason,
            declinedBy: userData?.name || 'Coach',
            declinedByUserId: userData?.uid,
          },
          createdAt: serverTimestamp()
        });
        console.log('✅ Sent decline notification to parent:', player.parentUserId);
      }
      
      // 4. Create notification for commissioner (program owner)
      const programDoc = await getDocs(query(collection(db, 'programs'), where('__name__', '==', programId)));
      if (!programDoc.empty) {
        const programData = programDoc.docs[0].data();
        if (programData.commissionerId && programData.commissionerId !== userData?.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: programData.commissionerId,
            type: 'player_declined',
            title: '⚠️ Player Declined from Draft Pool',
            message: `${userData?.name || 'Coach'} declined ${player.athleteFirstName} ${player.athleteLastName} from ${teamData?.name}. Reason: ${declineReason}`,
            category: 'team',
            priority: 'normal',
            read: false,
            link: '/commissioner',
            metadata: {
              athleteName: `${player.athleteFirstName} ${player.athleteLastName}`,
              teamName: teamData?.name || 'Team',
              reason: declineReason,
              declinedBy: userData?.name || 'Coach',
            },
            createdAt: serverTimestamp()
          });
          console.log('✅ Sent decline notification to commissioner:', programData.commissionerId);
        }
      }
      
      // 5. Notify all coaches on the team
      if (teamData) {
        const coachIdsToNotify: string[] = [];
        if (teamData.headCoachId) coachIdsToNotify.push(teamData.headCoachId);
        if (teamData.coachId) coachIdsToNotify.push(teamData.coachId);
        if (teamData.coachIds) coachIdsToNotify.push(...teamData.coachIds);
        if (teamData.offensiveCoordinatorId) coachIdsToNotify.push(teamData.offensiveCoordinatorId);
        if (teamData.defensiveCoordinatorId) coachIdsToNotify.push(teamData.defensiveCoordinatorId);
        if (teamData.ownerId) coachIdsToNotify.push(teamData.ownerId);
        
        // Remove duplicates only (notify everyone including the one who declined)
        const uniqueCoachIds = [...new Set(coachIdsToNotify)].filter(
          id => id && id !== player.parentUserId
        );
        
        for (const coachId of uniqueCoachIds) {
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: coachId,
              type: 'player_declined',
              title: '❌ Player Declined',
              message: `${userData?.name || 'A coach'} declined ${player.athleteFirstName} ${player.athleteLastName} from ${teamData?.name}. Reason: ${declineReason}`,
              category: 'team',
              priority: 'low',
              read: false,
              link: '/dashboard',
              metadata: {
                athleteName: `${player.athleteFirstName} ${player.athleteLastName}`,
                teamName: teamData?.name || 'Team',
                reason: declineReason,
                declinedBy: userData?.name || 'Coach',
              },
              createdAt: serverTimestamp()
            });
            console.log('✅ Sent decline notification to coach:', coachId);
          } catch (err) {
            console.error('Failed to notify coach:', coachId, err);
          }
        }
      }
      
      // 6. Update local state to remove player
      setDraftPoolPlayers(prev => prev.filter(p => p.id !== player.id));
      
      // 7. Close modal and show success
      setDeclineModalPlayer(null);
      setDeclineReason('');
      toastSuccess(`${player.athleteFirstName} ${player.athleteLastName} has been declined and removed from the draft pool`);
      
    } catch (error) {
      console.error('Error declining player:', error);
      toastError('Failed to decline player. Please try again.');
    } finally {
      setDecliningPlayer(false);
    }
  };

  // Handle drafting a player to the team roster
  const handleDraftPlayer = async () => {
    if (!draftModalPlayer || !teamData?.id) {
      toastError('Missing player or team data');
      return;
    }
    
    setDraftingPlayer(true);
    try {
      const programId = teamData?.programId;
      if (!programId) throw new Error('No program ID');
      
      const player = draftModalPlayer;
      const seasonId = player.seasonId;
      
      console.log('🎯 Drafting player to team:', { 
        teamId: teamData.id, 
        teamName: teamData.name,
        playerId: player.id,
        playerName: `${player.athleteFirstName} ${player.athleteLastName}`
      });
      
      // 1. Add player to team roster (teams/{teamId}/players collection)
      const playerData = {
        name: `${player.athleteFirstName} ${player.athleteLastName}`,
        firstName: player.athleteFirstName,
        lastName: player.athleteLastName,
        number: player.jerseyNumber || null,
        position: player.position || null,
        parentName: player.parentName,
        parentEmail: player.parentEmail,
        parentPhone: player.parentPhone,
        parentId: player.parentUserId || null,
        parentUserId: player.parentUserId || null,
        athleteId: player.athleteId || null,
        dateOfBirth: player.dateOfBirth || player.athleteDateOfBirth || null,
        ageGroup: player.ageGroup || teamData?.ageGroup || null,
        status: 'active',
        draftedAt: serverTimestamp(),
        draftedBy: userData?.uid,
        draftedByName: userData?.name || 'Coach',
        seasonId: seasonId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      let rosterRef;
      try {
        rosterRef = await addDoc(collection(db, 'teams', teamData.id, 'players'), playerData);
        console.log('✅ Step 1: Added player to roster:', rosterRef.id);
      } catch (rosterError: any) {
        console.error('❌ Step 1 FAILED - Could not add to team roster:', rosterError);
        throw new Error(`Failed to add player to roster: ${rosterError.message}`);
      }
      
      // 2. Update draft pool entry status to 'drafted'
      try {
        await updateDoc(doc(db, 'programs', programId, 'seasons', seasonId, 'draftPool', player.id), {
          status: 'drafted',
          draftedAt: serverTimestamp(),
          draftedBy: userData?.uid,
          draftedToTeamId: teamData.id,
          draftedToTeamName: teamData.name,
          rosterPlayerId: rosterRef.id,
          updatedAt: serverTimestamp()
        });
        console.log('✅ Step 2: Updated draft pool entry to drafted');
      } catch (poolError: any) {
        console.error('⚠️ Step 2 failed (non-fatal) - Could not update draft pool:', poolError);
        // Continue anyway - roster was added successfully
      }
      
      // 3. Update the top-level player document if athleteId exists
      if (player.athleteId) {
        try {
          await updateDoc(doc(db, 'players', player.athleteId), {
            teamId: teamData.id,
            teamName: teamData.name,
            rosterPlayerId: rosterRef.id,
            seasonId: seasonId,
            draftPoolStatus: 'drafted',
            draftPoolDraftedAt: serverTimestamp(),
            draftPoolDraftedBy: userData?.name || 'Coach',
            status: 'active',
            updatedAt: serverTimestamp(),
          });
          console.log('✅ Updated top-level player document');
        } catch (err) {
          console.error('⚠️ Failed to update player document (non-fatal):', err);
        }
      }
      
      // 4. Send notification to parent
      if (player.parentUserId) {
        await addDoc(collection(db, 'notifications'), {
          userId: player.parentUserId,
          type: 'player_drafted',
          title: '🎉 Player Drafted!',
          message: `${player.athleteFirstName} ${player.athleteLastName} has been drafted to ${teamData.name}!`,
          category: 'team',
          priority: 'high',
          read: false,
          link: '/dashboard',
          metadata: {
            athleteName: `${player.athleteFirstName} ${player.athleteLastName}`,
            teamId: teamData.id,
            teamName: teamData.name,
            draftedBy: userData?.name || 'Coach',
          },
          createdAt: serverTimestamp()
        });
        console.log('✅ Step 4: Sent draft notification to parent:', player.parentUserId);
      }
      
      // 4b. Send notifications to other coaches (except the one doing the drafting)
      const coachIdsToNotify: string[] = [];
      if (teamData.coachId && teamData.coachId !== userData?.uid) coachIdsToNotify.push(teamData.coachId);
      if (teamData.headCoachId && teamData.headCoachId !== userData?.uid && !coachIdsToNotify.includes(teamData.headCoachId)) {
        coachIdsToNotify.push(teamData.headCoachId);
      }
      (teamData.coachIds || []).forEach((id: string) => {
        if (id !== userData?.uid && !coachIdsToNotify.includes(id)) coachIdsToNotify.push(id);
      });
      
      if (coachIdsToNotify.length > 0) {
        createBulkNotifications(
          coachIdsToNotify,
          'roster_update',
          'New Player Drafted! 🎉',
          `${player.athleteFirstName} ${player.athleteLastName} has been drafted to ${teamData.name}.`,
          { link: '/roster', metadata: { teamId: teamData.id, playerName: `${player.athleteFirstName} ${player.athleteLastName}` } }
        ).catch(err => console.error('Error notifying coaches:', err));
        console.log('✅ Step 4b: Sent notifications to coaches');
      }
      
      // 4c. Notify commissioner if team is in a program
      if (teamData.programId) {
        try {
          const programSnap = await getDoc(doc(db, 'programs', teamData.programId));
          if (programSnap.exists()) {
            const programInfo = programSnap.data();
            const commissionerId = programInfo?.commissionerId;
            if (commissionerId && commissionerId !== userData?.uid) {
              createNotification(
                commissionerId,
                'roster_update',
                'Player Drafted to Team',
                `${player.athleteFirstName} ${player.athleteLastName} was drafted to ${teamData.name}.`,
                { link: '/commissioner', metadata: { teamId: teamData.id, playerName: `${player.athleteFirstName} ${player.athleteLastName}`, programId: teamData.programId } }
              ).catch(err => console.error('Error notifying commissioner:', err));
              console.log('✅ Step 4c: Sent notification to commissioner');
            }
          }
        } catch (err) {
          console.error('⚠️ Step 4c failed (non-fatal) - Could not notify commissioner:', err);
        }
      }
      
      // 5. Check if any players remain in draft pool for this age group
      // If not, set ageGroupsDraftActive[ageGroup] = false
      try {
        const playerAgeGroup = player.ageGroupName || player.ageGroup || '';
        if (playerAgeGroup) {
          const draftPoolRef = collection(db, 'programs', programId, 'seasons', seasonId, 'draftPool');
          const remainingSnap = await getDocs(draftPoolRef);
          
          // Count remaining 'available' players for this age group
          let remainingCount = 0;
          remainingSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            const docAgeGroup = data.ageGroupName || data.ageGroup || '';
            if (data.status !== 'drafted' && data.status !== 'declined' && docAgeGroup === playerAgeGroup) {
              remainingCount++;
            }
          });
          
          console.log(`📊 Remaining players in ${playerAgeGroup}: ${remainingCount}`);
          
          // If no more players for this age group, update the season flag
          if (remainingCount === 0) {
            await updateDoc(doc(db, 'programs', programId, 'seasons', seasonId), {
              [`ageGroupsDraftActive.${playerAgeGroup}`]: false,
              updatedAt: serverTimestamp()
            });
            console.log(`✅ Step 5: Set ageGroupsDraftActive.${playerAgeGroup} = false (draft complete for this age group)`);
          }
        }
      } catch (err) {
        console.error('⚠️ Step 5 failed (non-fatal) - Could not check remaining players:', err);
      }
      
      // 6. Update local state to remove player from draft pool
      setDraftPoolPlayers(prev => prev.filter(p => p.id !== player.id));
      
      // 7. Close modal and show success
      setDraftModalPlayer(null);
      toastSuccess(`${player.athleteFirstName} ${player.athleteLastName} has been drafted to ${teamData.name}!`);
      
    } catch (error) {
      console.error('Error drafting player:', error);
      toastError('Failed to draft player. Please try again.');
    } finally {
      setDraftingPlayer(false);
    }
  };

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

  // Calculate team record from COMPLETED games only
  const getTeamRecord = () => {
    // Only count games with status === 'completed'
    const completedGames = allGames.filter(g => g.status === 'completed');
    
    let wins = 0;
    let losses = 0;
    let ties = 0;
    
    completedGames.forEach(game => {
      // Determine this team's score and opponent's score
      const isHome = game.homeTeamId === teamData?.id;
      const teamScore = isHome ? (game.homeScore ?? 0) : (game.awayScore ?? 0);
      const oppScore = isHome ? (game.awayScore ?? 0) : (game.homeScore ?? 0);
      
      if (teamScore > oppScore) {
        wins++;
      } else if (teamScore < oppScore) {
        losses++;
      } else {
        ties++;
      }
    });
    
    // Return format: "W-L" or "W-L-T" if there are ties
    if (ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }
    return `${wins}-${losses}`;
  };

  // State for Season Management modal
  const [showSeasonManager, setShowSeasonManager] = useState(false);

  // Check if user is an independent athlete (18+ signup or released player)
  const isIndependentAthlete = userData?.role === 'Athlete' && (userData?.isIndependentAthlete === true);
  
  // Can the user access advanced features like Go Live, Fundraise?
  const canAccessAdvancedFeatures = userData?.role === 'Coach' || userData?.role === 'SuperAdmin' || isIndependentAthlete;

  // Quick actions based on sport and role
  const isParent = userData?.role === 'Parent';
  const isCoachOrAdmin = userData?.role === 'Coach' || userData?.role === 'SuperAdmin';
  
  const quickActions = isParent ? [
    // Parent-specific quick actions
    { icon: '📢', label: 'Announce', link: '/chat' },
    { icon: '💫', label: 'Send Kudos', link: '/chat' },
    { icon: '⚠️', label: 'File Grievance', link: '/grievance' },
  ] : [
    // Coach/Admin quick actions
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
    ...(isCoachOrAdmin ? [{ icon: '📆', label: 'Manage Season', action: () => setShowSeasonManager(true) }] : []),
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
    const typeMap: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'default' | 'gold' }> = {
      practice: { label: 'PRACTICE', variant: 'primary' },
      game: { label: 'GAME', variant: 'gold' },
      meeting: { label: 'MEETING', variant: 'warning' },
      event: { label: 'EVENT', variant: 'success' },
      social: { label: 'SOCIAL', variant: 'success' },
      scrimmage: { label: 'SCRIMMAGE', variant: 'warning' },
      tournament: { label: 'TOURNAMENT', variant: 'gold' },
      tryout: { label: 'TRYOUT', variant: 'primary' },
      camp: { label: 'CAMP', variant: 'success' },
      fundraiser: { label: 'FUNDRAISER', variant: 'warning' },
    };
    // Default to 'warning' variant for visibility (orange/amber is always visible)
    return typeMap[type?.toLowerCase() || ''] || { label: type?.toUpperCase() || 'EVENT', variant: 'warning' as const };
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
  const formatEventDateDisplay = (dateInput: any) => {
    if (!dateInput) return { day: '--', month: '---', full: '' };
    // Handle Firestore Timestamp, Date, or string
    let date: Date;
    if (dateInput?.toDate) {
      date = dateInput.toDate();
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string' && dateInput.includes('-')) {
      const [year, month, day] = dateInput.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(dateInput);
    }
    return {
      day: date.getDate().toString(),
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

  // Convert program games to event format for unified display in Upcoming
  const gamesAsEvents: EventData[] = allGames
    .filter(game => game.status !== 'completed') // Only upcoming games
    .map(game => {
      // Get date from scheduledDate
      let eventDate: Date | null = null;
      if (game.scheduledDate) {
        if (typeof game.scheduledDate === 'string') {
          eventDate = new Date(game.scheduledDate);
        } else if (game.scheduledDate instanceof Date) {
          eventDate = game.scheduledDate;
        } else if (game.scheduledDate?.toDate) {
          eventDate = game.scheduledDate.toDate();
        }
      }
      
      return {
        id: `game-${game.id}`,
        title: `${game.isHome ? 'vs' : '@'} ${game.opponent || 'TBD'}`,
        eventType: 'game',
        eventStartDate: eventDate ? { toDate: () => eventDate } : null,
        eventStartTime: game.scheduledTime || '',
        location: game.location || '',
        description: `Week ${game.week || '?'} Game`,
        isGameFromProgram: true, // Flag to identify program games
        gameData: game, // Store original game data for click handler
      } as EventData;
    })
    .filter(event => {
      // Filter to only future games (including today)
      const eventDate = event.eventStartDate?.toDate?.();
      if (!eventDate) return true; // Include games without dates
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return eventDate >= startOfToday;
    });

  // Combine events and games for unified Upcoming section
  const allUpcomingEvents = [...events, ...gamesAsEvents].sort((a, b) => {
    const dateA = a.eventStartDate?.toDate?.() || new Date(9999, 11, 31);
    const dateB = b.eventStartDate?.toDate?.() || new Date(9999, 11, 31);
    return dateA.getTime() - dateB.getTime();
  });

  // Filter events by type
  const filteredEvents = allUpcomingEvents.filter(event => {
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

  // Determine if player is in draft pool (requires BOTH status AND sport to be set)
  const isInDraftPool = selectedSportContext?.status === 'draft_pool' && selectedSportContext?.sport;
  const draftPoolInfo = isInDraftPool ? {
    sport: selectedSportContext.sport,
    teamName: selectedSportContext.draftPoolTeamName,
    ageGroup: selectedSportContext.draftPoolAgeGroup,
  } : null;

  // Show draft pool status for parents with players in draft pool
  if (userData?.role === 'Parent' && players.length > 0 && !teamData?.id && isInDraftPool && draftPoolInfo) {
    const sportEmoji: Record<string, string> = {
      football: '🏈',
      basketball: '🏀',
      cheer: '📣',
      soccer: '⚽',
      baseball: '⚾',
      volleyball: '🏐',
      other: '🎯',
    };
    
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={`rounded-2xl p-8 max-w-lg text-center border shadow-xl ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-zinc-900 to-zinc-950 border-emerald-900/30' 
            : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
        }`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg ${
            theme === 'dark' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
          }`}>
            <span className="text-4xl">🎉</span>
          </div>
          
          <h2 className={`text-2xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            You're in the Draft Pool!
          </h2>
          
          <p className={`mb-6 text-lg ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
            Your athlete is registered for {sportEmoji[draftPoolInfo.sport] || '🎯'}{' '}
            <span className={`font-semibold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {draftPoolInfo.teamName || 'the program'}
            </span>
            {draftPoolInfo.ageGroup && (
              <span className="text-sm"> ({draftPoolInfo.ageGroup})</span>
            )} and waiting to be drafted to a team.
          </p>
          
          <div className={`rounded-xl p-5 mb-6 border ${
            theme === 'dark' ? 'bg-zinc-900/50 border-emerald-900/30' : 'bg-white border-emerald-200'
          }`}>
            <div className="flex items-start gap-3 text-left">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
              }`}>
                <Clock className={`w-5 h-5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
              </div>
              <div>
                <h4 className={`font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>What happens next?</h4>
                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                  The coach will review registrations and draft players to the roster. You'll be notified when your athlete is assigned to a team.
                </p>
              </div>
            </div>
          </div>
          
          <div className={`rounded-xl p-4 border ${
            theme === 'dark' ? 'bg-amber-900/20 border-amber-900/30' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}>
                Once drafted, the team dashboard will load here automatically.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show onboarding for parents with players but NOT on a team yet (and not in draft pool)
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

      {/* Live Stream Banner - Show when there's a live stream AND no live game (Game Day Hub handles live game streams) */}
      {liveStreams.length > 0 && !allGames.some(g => g.status === 'live') && (
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

      {/* Go Live Button for Coaches - Show when no active stream AND no live game */}
      {canGoLive && !hasOwnLiveStream && !allGames.some(g => g.status === 'live') && (
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

      {/* Header - Greeting */}
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
        {/* Record Card - Shows calculated record from completed games */}
        <div 
          className={`p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border ${theme === 'dark' ? 'border-white/10' : 'border-amber-200'}`}
          title="Record calculated from completed games"
        >
          <div className="flex items-center justify-between">
            <div className="text-2xl mb-1">🏆</div>
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
        
        {/* Events Card - Includes both events and games */}
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border ${theme === 'dark' ? 'border-white/10' : 'border-green-200'}`}>
          <div className="text-2xl mb-1">📅</div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>{allUpcomingEvents.length}</div>
          <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Upcoming Events</div>
        </div>
      </div>

      {/* Draft Pool - Program-level pool for coaches in a program */}
      {teamData?.programId && draftPoolPlayers.length > 0 && (
        <GlassCard className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              theme === 'dark' ? 'bg-gradient-to-br from-orange-500/30 to-purple-500/30' : 'bg-gradient-to-br from-orange-100 to-purple-100'
            }`}>
              <Trophy className={`w-5 h-5 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Draft Pool</h2>
              <p className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                {draftPoolPlayers.length} player{draftPoolPlayers.length !== 1 ? 's' : ''} waiting to be drafted
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            {draftPoolPlayers.map((player, idx) => (
              <div 
                key={player.id || idx}
                className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                    }`}>
                      {(player.athleteFirstName || player.firstName)?.[0]}{(player.athleteLastName || player.lastName)?.[0]}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Name Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-base ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                          {player.athleteFirstName || player.firstName} {player.athleteLastName || player.lastName}
                        </span>
                        {player.athleteNickname && (
                          <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                            "{player.athleteNickname}"
                          </span>
                        )}
                      </div>
                      
                      {/* Badges Row */}
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        {player.athleteUsername && (
                          <a
                            href={`/#/athlete/${player.athleteUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              theme === 'dark' 
                                ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            }`}
                          >
                            @{player.athleteUsername}
                          </a>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {player.ageGroupName || player.ageGroup || 'Pool'}
                        </span>
                        {player.paymentStatus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            player.paymentStatus === 'paid' 
                              ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                              : player.paymentStatus === 'partial'
                                ? theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                                : theme === 'dark' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {player.paymentStatus === 'paid' ? '✓ Paid' : player.paymentStatus === 'partial' ? '◐ Partial' : '○ Pending'}
                          </span>
                        )}
                      </div>
                      
                      {/* Jersey & Position */}
                      {(player.preferredJerseyNumber || player.preferredPosition) && (
                        <div className={`flex items-center gap-2 mt-1.5 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          {player.preferredJerseyNumber && <span className="font-medium">#{player.preferredJerseyNumber}</span>}
                          {player.preferredPosition && <span>• {player.preferredPosition}</span>}
                        </div>
                      )}
                      
                      {/* Parent Suggestions / Coach Notes */}
                      {(player.coachNotes || player.parentSuggestions || player.notes) && (
                        <div className={`mt-2 p-2 rounded-lg text-sm ${
                          theme === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'
                        }`}>
                          <span className={`font-medium ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                            💬 Parent Notes:
                          </span>
                          <span className={`ml-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                            {player.coachNotes || player.parentSuggestions || player.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setDraftModalPlayer(player);
                      }}
                      disabled={isRegistrationOpen}
                      title={isRegistrationOpen ? 'Draft available after registration closes' : 'Add player to roster'}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isRegistrationOpen
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {isRegistrationOpen ? '🔒 Draft' : 'Draft'}
                    </button>
                    <button
                      onClick={() => {
                        setDeclineModalPlayer(player);
                        setDeclineReason('');
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        theme === 'dark' 
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                          : 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-200'
                      }`}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Registration Open Notice */}
          {isRegistrationOpen && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'
            }`}>
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={`text-sm ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                Draft will be available after registration closes
              </span>
            </div>
          )}
        </GlassCard>
      )}
      
      {/* Draft Pool - OLD team-level for teams NOT in a program */}
      {teamData?.id && teamData?.sport && teamData?.ageGroup && !teamData?.programId && (
        <DraftPool
          teamId={teamData.id}
          teamOwnerId={(teamData as any).ownerId || teamData.coachId || ''}
          sport={teamData.sport}
          ageGroup={teamData.ageGroup}
          registrationCloseDate={registrationCloseDate}
        />
      )}

      {/* 🏈 GAME DAY HUB - Shows ALL games, coach can select any to view/manage */}
      {teamData?.id && allGames.length > 0 && (
        <GameDayHub
          games={allGames}
          liveStreams={liveStreams}
          onGoLive={() => setShowGoLiveModal(true)}
          onOpenStats={() => navigate('/stats')}
          teamId={teamData.id}
        />
      )}

      {/* SEASON MANAGEMENT (Coaches & Parents) */}
      {(userData?.role === 'Coach' || userData?.role === 'SuperAdmin' || userData?.role === 'Parent') && teamData?.id && (
        <GlassCard className={`${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : ''}`}>
          {/* Collapsible Header */}
          <button 
            onClick={() => setSeasonManagerCollapsed(!seasonManagerCollapsed)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">📆</div>
              <div className="text-left">
                <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>Season Management</h2>
                <p className={`text-xs ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-500'}`}>
                  {teamData?.programId ? 'Managed by your program commissioner' : 'Manage registration and seasons'}
                </p>
              </div>
            </div>
            
            {/* Collapsed view: show active season name + status */}
            <div className="flex items-center gap-3">
              {seasonManagerCollapsed && programSeasons.length > 0 && (() => {
                const activeSeason = programSeasons.find(s => s.status === 'active') || programSeasons.find(s => s.status !== 'completed');
                if (!activeSeason) return null;
                const statusColors: Record<string, string> = {
                  'setup': theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-slate-200 text-slate-600',
                  'registration_open': theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700',
                  'registration_closed': theme === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700',
                  'teams_forming': theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
                  'active': theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700',
                  'completed': theme === 'dark' ? 'bg-gray-600 text-gray-400' : 'bg-slate-300 text-slate-500',
                };
                const statusLabels: Record<string, string> = {
                  'setup': '⚙️ Setup',
                  'registration_open': '🟢 Open',
                  'registration_closed': '🔒 Closed',
                  'teams_forming': '👥 Forming',
                  'active': '🏈 Season Active',
                  'completed': '✅ Done',
                };
                return (
                  <>
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {activeSeason.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[activeSeason.status] || statusColors['setup']}`}>
                      {statusLabels[activeSeason.status] || activeSeason.status}
                    </span>
                  </>
                );
              })()}
              <ChevronDown className={`w-5 h-5 transition-transform ${seasonManagerCollapsed ? '' : 'rotate-180'} ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
          </button>
          
          {/* Collapsible Content */}
          {!seasonManagerCollapsed && (
            <div className="mt-4">
          
          {/* If team belongs to a program, show program seasons */}
          {teamData?.programId && programSeasons.length > 0 ? (
            (() => {
              // Separate active and completed seasons
              const activeSeasons = programSeasons.filter(s => s.status !== 'completed');
              const completedSeasons = programSeasons.filter(s => s.status === 'completed');
              
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
              
              // Render a single season card
              const renderSeasonCard = (season: ProgramSeason) => (
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
                      <span>
                        {draftPoolPlayers.filter(p => p.seasonId === season.id).length} registered
                        {teamData?.ageGroup && ` (${teamData.ageGroup})`}
                      </span>
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
                  
                  {/* Create Flyer Prompt - Only for setup/registration_open seasons (not active or completed) */}
                  {(season.status === 'setup' || season.status === 'registration_open') && (
                    <button
                      onClick={() => {
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
                  )}
                </div>
              );
              
              return (
                <div className="space-y-3">
                  {/* Active Seasons First */}
                  {activeSeasons.map(renderSeasonCard)}
                  
                  {/* Completed Seasons - Collapsed by default */}
                  {completedSeasons.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowCompletedSeasons(!showCompletedSeasons)}
                        className={`w-full p-3 rounded-xl flex items-center justify-between transition-colors ${
                          theme === 'dark' 
                            ? 'bg-white/5 hover:bg-white/10 border border-white/10' 
                            : 'bg-slate-100 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Check className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`} />
                          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                            Completed Seasons ({completedSeasons.length})
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${
                          showCompletedSeasons ? 'rotate-180' : ''
                        } ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`} />
                      </button>
                      
                      {showCompletedSeasons && (
                        <div className="space-y-3 mt-2">
                          {completedSeasons.map(renderSeasonCard)}
                        </div>
                      )}
                    </>
                  )}
                  
                  <p className={`text-xs text-center mt-4 ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`}>
                    Seasons are managed by {teamData?.programName || programSeasons[0]?.programName || 'your program commissioner'}
                  </p>
                </div>
              );
            })()
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
            </div>
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
                <Link
                  to="/events/create"
                  className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition"
                >
                  <Plus className="w-4 h-4" />
                </Link>
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
                        {event.eventStartTime && ` • ${formatTime12Hour(event.eventStartTime)}`}
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
            {roster.slice(0, 5).map((player) => {
              // Check if this player belongs to the current parent
              const isMyChild = userData?.role === 'Parent' && (
                player.parentId === userData?.uid || 
                player.parentUserId === userData?.uid
              );
              // Build display name with nickname
              const displayName = player.nickname 
                ? `${player.firstName || player.name?.split(' ')[0] || ''} "${player.nickname}" ${player.lastName || player.name?.split(' ').slice(1).join(' ') || ''}`
                : player.name;
              return (
                <div 
                  key={player.id}
                  className={`flex items-center gap-3 p-2 rounded-lg transition ${
                    isMyChild 
                      ? theme === 'dark' 
                        ? 'bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30' 
                        : 'bg-purple-100 border border-purple-300 hover:bg-purple-200'
                      : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                  }`}
                >
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <Avatar name={player.name} size="sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>
                      {displayName}
                      {isMyChild && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>
                          Your Child
                        </span>
                      )}
                    </div>
                    <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      #{player.number || '--'} • {player.position || 'No position'}
                    </div>
                  </div>
                </div>
              );
            })}
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
                    coach.isHeadCoach
                      ? theme === 'dark'
                        ? 'bg-amber-500/10 hover:bg-amber-500/20 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20'
                        : 'bg-amber-50 hover:bg-amber-100 ring-2 ring-amber-400 shadow-lg shadow-amber-200'
                      : theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'
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
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${
                        theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'
                      }`}>
                        <Crown className="w-2.5 h-2.5" /> HC
                      </span>
                    )}
                    {coach.isOC && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${
                        theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                      }`}>
                        <Sword className="w-2.5 h-2.5" /> OC
                      </span>
                    )}
                    {coach.isDC && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${
                        theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                      }`}>
                        <Shield className="w-2.5 h-2.5" /> DC
                      </span>
                    )}
                    {coach.isSTC && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${
                        theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        <Zap className="w-2.5 h-2.5" /> STC
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
                
                {/* Actions for Coaches - Hide for program games (view only) */}
                {userData?.role === 'Coach' && !(selectedEvent as any).isGameFromProgram && (
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

      {/* Draft Player Confirmation Modal */}
      {draftModalPlayer && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDraftModalPlayer(null)}
        >
          <div 
            className={`w-full max-w-md rounded-xl shadow-xl ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
                }`}>
                  <UserPlus className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                </div>
                <div>
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Draft Player to Team
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    {draftModalPlayer.athleteFirstName} {draftModalPlayer.athleteLastName}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Player Info */}
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}>Age Group:</span>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {draftModalPlayer.ageGroup || teamData?.ageGroup || 'N/A'}
                    </p>
                  </div>
                  {draftModalPlayer.position && (
                    <div>
                      <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}>Position:</span>
                      <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {draftModalPlayer.position}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}>Parent:</span>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {draftModalPlayer.parentName}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Team destination */}
              <div className={`p-3 rounded-lg flex items-center gap-3 ${
                theme === 'dark' ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'
              }`}>
                <Users className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                <div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                    Adding to team:
                  </p>
                  <p className={`font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-800'}`}>
                    {teamData?.name}
                  </p>
                </div>
              </div>
              
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                Are you sure you want to draft this player? They will be added to your team roster and the parent will be notified.
              </p>
            </div>
            
            {/* Footer */}
            <div className={`p-4 border-t flex gap-3 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={() => setDraftModalPlayer(null)}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                  theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDraftPlayer}
                disabled={draftingPlayer}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {draftingPlayer ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Draft Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Player Modal */}
      {declineModalPlayer && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { setDeclineModalPlayer(null); setDeclineReason(''); }}
        >
          <div 
            className={`w-full max-w-md rounded-xl shadow-xl ${theme === 'dark' ? 'bg-zinc-900 border border-white/10' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
                </div>
                <div>
                  <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Decline Player
                  </h3>
                  <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    {declineModalPlayer.athleteFirstName} {declineModalPlayer.athleteLastName}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'
              }`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
                  ⚠️ This action will remove the player from the draft pool and notify the parent and commissioner.
                </p>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
                  Reason for declining <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="e.g., Roster full, age group mismatch, player requested different team..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  } focus:ring-2 focus:ring-red-500/50 focus:border-red-500`}
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className={`p-4 border-t flex gap-3 justify-end ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={() => { setDeclineModalPlayer(null); setDeclineReason(''); }}
                disabled={decliningPlayer}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  theme === 'dark' 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeclinePlayer}
                disabled={decliningPlayer || !declineReason.trim()}
                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                  decliningPlayer || !declineReason.trim()
                    ? 'bg-red-400 text-red-100 cursor-not-allowed opacity-60'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {decliningPlayer ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Declining...
                  </>
                ) : (
                  'Confirm Decline'
                )}
              </button>
            </div>
          </div>
        </div>
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
