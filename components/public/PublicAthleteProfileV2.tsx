import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy, setDoc, deleteDoc, updateDoc, increment, Timestamp, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Player, Team, PlayerSeasonStats, Game, GamePlayerStats, PlayerFilmEntry, AthleteFollower } from '../../types';
import { User, Trophy, Star, Zap, Users, Home, Award, Heart, Film, Play, X, ChevronRight, UserPlus, UserMinus, Loader2, MessageCircle, DollarSign, Send, Mail, Building2, Share2, MapPin, Calendar, TrendingUp, Target, Shield, Activity, Eye, Clock, ChevronDown, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { AnimatedBackground, GlassCard, Button, Badge, ProgressBar } from '../ui/OSYSComponents';
import PublicChat from './PublicChat';
import AthletePosts from './AthletePosts';
import AthleteKudos from './AthleteKudos';
import FanClipGallery from './FanClipGallery';
import { showToast } from '../../services/toast';

interface PublicAthleteData {
  player: Player;
  team: Team | null;
  teamId: string | null;
  seasonStats: PlayerSeasonStats | null;
  recentGames: { game: Game; stats: GamePlayerStats }[];
  careerStats: { season: number; teamName: string; stats: PlayerSeasonStats }[];
  isSportsmanshipLeader: boolean;
  sportsmanshipPoints: number;
  filmRoom: PlayerFilmEntry[];
}

const PublicAthleteProfileV2: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [data, setData] = useState<PublicAthleteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('stats');
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Follow state for fans
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  
  // NIL Inquiry state
  const [showNILModal, setShowNILModal] = useState(false);
  const [nilForm, setNilForm] = useState({
    companyName: '',
    dealType: 'sponsorship' as const,
    description: '',
    estimatedValue: '',
    contactEmail: userData?.email || user?.email || ''
  });
  const [nilSubmitting, setNilSubmitting] = useState(false);

  // Check if current user is following this athlete
  useEffect(() => {
    if (data && userData?.role === 'Fan' && userData.followedAthletes) {
      const athleteKey = `${data.teamId || 'unassigned'}_${data.player.id}`;
      setIsFollowing(userData.followedAthletes.includes(athleteKey));
    }
    if (data?.player) {
      setFollowerCount(data.player.followerCount || 0);
    }
  }, [data, userData]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!user || !userData || userData.role !== 'Fan' || !data) return;
    
    setFollowLoading(true);
    const athleteKey = `${data.teamId || 'unassigned'}_${data.player.id}`;
    
    const playerDocPath = data.teamId 
      ? doc(db, 'teams', data.teamId, 'players', data.player.id)
      : doc(db, 'players', data.player.id);
    
    const followerDocPath = data.teamId
      ? doc(db, 'teams', data.teamId, 'players', data.player.id, 'followers', user.uid)
      : doc(db, 'players', data.player.id, 'followers', user.uid);
    
    try {
      if (isFollowing) {
        await updateDoc(doc(db, 'users', user.uid), {
          followedAthletes: arrayRemove(athleteKey)
        });
        await deleteDoc(followerDocPath);
        await updateDoc(playerDocPath, { followerCount: increment(-1) });
        setFollowerCount(prev => Math.max(0, prev - 1));
        setIsFollowing(false);
        showToast('Unfollowed athlete', 'info');
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          followedAthletes: arrayUnion(athleteKey)
        });
        const followerData: AthleteFollower = {
          oddsId: user.uid,
          fanName: userData.name || 'Fan',
          fanUsername: userData.username || '',
          followedAt: Timestamp.now(),
          isVerified: false
        };
        await setDoc(followerDocPath, followerData);
        await updateDoc(playerDocPath, { followerCount: increment(1) });
        setFollowerCount(prev => prev + 1);
        setIsFollowing(true);
        showToast(`Now following ${data.player.name}!`, 'success');
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
      showToast('Failed to update follow status', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle NIL Inquiry submission
  const handleNILInquiry = async () => {
    if (!user || !userData || !data) {
      showToast('Please sign in to submit NIL inquiries', 'error');
      return;
    }
    
    if (!nilForm.companyName.trim() || !nilForm.description.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setNilSubmitting(true);
    try {
      await addDoc(collection(db, 'nilDeals'), {
        athleteId: data.player.id,
        athleteName: data.player.name,
        teamId: data.teamId,
        teamName: data.team?.name || '',
        sponsorId: user.uid,
        sponsorName: userData.name || 'Unknown',
        sponsorEmail: nilForm.contactEmail || user.email,
        sponsorCompany: nilForm.companyName,
        sponsorContact: nilForm.contactEmail,
        dealType: nilForm.dealType,
        description: nilForm.description,
        amount: nilForm.estimatedValue ? Math.round(parseFloat(nilForm.estimatedValue) * 100) : 0,
        status: 'pending',
        startDate: Timestamp.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      showToast('NIL inquiry sent! The athlete will review your proposal.', 'success');
      setShowNILModal(false);
      setNilForm({
        companyName: '',
        dealType: 'sponsorship',
        description: '',
        estimatedValue: '',
        contactEmail: userData?.email || user?.email || ''
      });
    } catch (err) {
      console.error('Error submitting NIL inquiry:', err);
      showToast('Failed to submit inquiry. Please try again.', 'error');
    } finally {
      setNilSubmitting(false);
    }
  };

  // Fetch athlete data
  useEffect(() => {
    const fetchAthleteData = async () => {
      if (!username) {
        setError('No username provided');
        setLoading(false);
        return;
      }

      try {
        const normalizedUsername = username.toLowerCase();
        let foundPlayer: Player | null = null;
        let foundTeamId: string | null = null;

        // Search top-level players collection first
        const topLevelQuery = query(collection(db, 'players'));
        const topLevelSnapshot = await getDocs(topLevelQuery);
        
        for (const playerDoc of topLevelSnapshot.docs) {
          const playerData = playerDoc.data();
          const playerUsername = playerData.username?.toLowerCase();
          
          if (playerUsername === normalizedUsername) {
            foundPlayer = { id: playerDoc.id, teamId: playerData.teamId || null, ...playerData } as Player;
            foundTeamId = playerData.teamId || null;
            break;
          }
        }
        
        // Search team players if not found
        if (!foundPlayer) {
          const teamsSnapshot = await getDocs(collection(db, 'teams'));
          for (const teamDoc of teamsSnapshot.docs) {
            const playersRef = collection(db, 'teams', teamDoc.id, 'players');
            const playersSnapshot = await getDocs(playersRef);
            
            for (const playerDoc of playersSnapshot.docs) {
              const playerData = playerDoc.data();
              const playerUsername = playerData.username?.toLowerCase();
              
              if (playerUsername === normalizedUsername) {
                foundPlayer = { id: playerDoc.id, ...playerData } as Player;
                foundTeamId = teamDoc.id;
                break;
              }
            }
            if (foundPlayer) break;
          }
        }

        if (!foundPlayer) {
          setError('Athlete not found');
          setLoading(false);
          return;
        }

        // Get team data
        let team: Team | null = null;
        if (foundTeamId) {
          const teamDoc = await getDoc(doc(db, 'teams', foundTeamId));
          team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : null;
        }

        // Get season stats
        const currentYear = new Date().getFullYear();
        let seasonStats: PlayerSeasonStats | null = null;
        let recentGames: { game: Game; stats: GamePlayerStats }[] = [];
        
        if (foundTeamId) {
          const seasonStatsId = `${foundPlayer.id}_${currentYear}`;
          const seasonStatsDoc = await getDoc(doc(db, 'teams', foundTeamId, 'seasonStats', seasonStatsId));
          seasonStats = seasonStatsDoc.exists() 
            ? { id: seasonStatsDoc.id, ...seasonStatsDoc.data() } as PlayerSeasonStats 
            : null;

          // Get recent games
          const gamesQuery = query(
            collection(db, 'teams', foundTeamId, 'games'),
            where('season', '==', currentYear)
          );
          const gamesSnapshot = await getDocs(gamesQuery);
          const games = gamesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game));
          games.sort((a, b) => b.date.localeCompare(a.date));

          for (const game of games.slice(0, 5)) {
            const playerStatsDoc = await getDoc(
              doc(db, 'teams', foundTeamId, 'games', game.id, 'playerStats', foundPlayer.id)
            );
            if (playerStatsDoc.exists()) {
              const stats = { id: playerStatsDoc.id, ...playerStatsDoc.data() } as GamePlayerStats;
              if (stats.played) {
                recentGames.push({ game, stats });
              }
            }
          }
        }

        // Get career stats and film room
        const careerStats: { season: number; teamName: string; stats: PlayerSeasonStats }[] = [];
        let isSportsmanshipLeader = false;
        let playerSportsmanshipPoints = (seasonStats as any)?.spts || 0;
        let filmRoom: PlayerFilmEntry[] = [];
        
        if (foundTeamId) {
          const allSeasonStatsQuery = query(collection(db, 'teams', foundTeamId, 'seasonStats'));
          const allSeasonStatsSnapshot = await getDocs(allSeasonStatsQuery);
          
          for (const statDoc of allSeasonStatsSnapshot.docs) {
            const stat = statDoc.data() as PlayerSeasonStats;
            if (stat.playerId === foundPlayer.id) {
              careerStats.push({
                season: stat.season,
                teamName: team?.name || 'Unknown Team',
                stats: { id: statDoc.id, ...stat }
              });
            }
          }
          careerStats.sort((a, b) => b.season - a.season);

          // Check sportsmanship leader
          let highestSportsmanship = 0;
          let leaderId: string | null = null;

          for (const statDoc of allSeasonStatsSnapshot.docs) {
            const stat = statDoc.data() as PlayerSeasonStats;
            if (stat.season === currentYear) {
              const spts = (stat as any).spts || 0;
              if (spts > highestSportsmanship) {
                highestSportsmanship = spts;
                leaderId = stat.playerId;
              }
            }
          }

          if (leaderId === foundPlayer.id && playerSportsmanshipPoints > 0) {
            isSportsmanshipLeader = true;
          }

          // Fetch film room
          const filmRoomSnapshot = await getDocs(collection(db, 'teams', foundTeamId, 'players', foundPlayer.id, 'filmRoom'));
          filmRoom = filmRoomSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlayerFilmEntry));
          filmRoom.sort((a, b) => {
            const aTime = a.taggedAt?.toMillis?.() || 0;
            const bTime = b.taggedAt?.toMillis?.() || 0;
            return bTime - aTime;
          });
        }

        setData({
          player: foundPlayer,
          team,
          teamId: foundTeamId,
          seasonStats,
          recentGames,
          careerStats,
          isSportsmanshipLeader,
          sportsmanshipPoints: playerSportsmanshipPoints,
          filmRoom
        });
      } catch (err) {
        console.error('Error fetching athlete data:', err);
        setError('Failed to load athlete profile');
      } finally {
        setLoading(false);
      }
    };

    fetchAthleteData();
  }, [username]);

  // Format number helper
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Get YouTube thumbnail
  const getYouTubeThumbnail = (videoId: string) => {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  };

  // Calculate key stats based on player position
  const getKeyStats = () => {
    if (!data?.seasonStats) return [];
    const stats = data.seasonStats as any;
    const position = data.player.position?.toUpperCase() || '';
    
    if (['QB', 'QUARTERBACK'].includes(position)) {
      return [
        { label: 'Pass Yards', value: stats.passYds || 0 },
        { label: 'Touchdowns', value: stats.passTd || 0 },
        { label: 'Comp %', value: stats.passAtt > 0 ? Math.round((stats.passComp / stats.passAtt) * 100) + '%' : '0%' },
        { label: 'Rating', value: stats.qbr || 0 }
      ];
    } else if (['RB', 'RUNNING BACK', 'HB', 'FB'].includes(position)) {
      return [
        { label: 'Rush Yards', value: stats.rushYds || 0 },
        { label: 'Rush TDs', value: stats.rushTd || 0 },
        { label: 'Yards/Carry', value: stats.rushAtt > 0 ? (stats.rushYds / stats.rushAtt).toFixed(1) : '0' },
        { label: 'Total TDs', value: (stats.rushTd || 0) + (stats.recTd || 0) }
      ];
    } else if (['WR', 'WIDE RECEIVER', 'TE', 'TIGHT END'].includes(position)) {
      return [
        { label: 'Receptions', value: stats.rec || 0 },
        { label: 'Rec Yards', value: stats.recYds || 0 },
        { label: 'Rec TDs', value: stats.recTd || 0 },
        { label: 'Yards/Catch', value: stats.rec > 0 ? (stats.recYds / stats.rec).toFixed(1) : '0' }
      ];
    } else {
      // Default defensive stats
      return [
        { label: 'Tackles', value: stats.tkl || 0 },
        { label: 'Sacks', value: stats.sacks || 0 },
        { label: 'INTs', value: stats.int || 0 },
        { label: 'TFLs', value: stats.tfl || 0 }
      ];
    }
  };

  const currentYear = new Date().getFullYear();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="mt-4 text-slate-400 animate-pulse">Loading athlete profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <AnimatedBackground />
        <div className="relative z-10 bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 text-center max-w-md border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 mx-auto mb-4 flex items-center justify-center">
            <User className="w-8 h-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Athlete Not Found</h1>
          <p className="text-slate-400 mb-6">
            The athlete profile you're looking for doesn't exist or has been removed.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-indigo-500/30"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const { player, team, teamId, seasonStats, recentGames, careerStats, isSportsmanshipLeader, sportsmanshipPoints, filmRoom } = data;
  const keyStats = getKeyStats();

  const tabs = [
    { id: 'stats', label: '📊 Stats', icon: TrendingUp },
    { id: 'posts', label: '📝 Posts', icon: MessageCircle },
    { id: 'highlights', label: '🎬 Highlights', icon: Film, count: filmRoom.length },
    { id: 'fundraising', label: '💰 Fundraising', icon: DollarSign },
    { id: 'chat', label: '💬 Chat', icon: MessageCircle }
  ];

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Premium Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 text-xl font-black tracking-tight">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">OSYS</span>
          </Link>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast('Link copied!', 'success');
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <span className="text-xs text-slate-500 px-3 py-1 rounded-full bg-slate-800/50 border border-white/10">
              Athlete Profile
            </span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-20">
        {/* Hero Background Gradient */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-indigo-900/40 via-purple-900/20 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.3),transparent_70%)]" />
        
        {/* Profile Header */}
        <div className="relative max-w-6xl mx-auto px-4 pt-8 pb-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* Jersey Number Card - Premium Yellow Design */}
            <div className="relative flex-shrink-0">
              <div className="w-32 h-40 lg:w-36 lg:h-44 bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/30 border-4 border-amber-300/50 relative overflow-hidden">
                {/* Diagonal stripe pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-white/30 to-transparent transform rotate-12" />
                </div>
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-5xl lg:text-6xl font-black text-slate-900 drop-shadow-lg">
                    {player.jerseyNumber || player.number || '?'}
                  </span>
                )}
                
                {/* Verified Badge */}
                {(player as any).isVerified && (
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center border-4 border-slate-950 shadow-lg">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              
              {/* Online indicator */}
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-slate-950 animate-pulse" />
            </div>
            
            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              {/* Badges Row */}
              <div className="flex flex-wrap gap-2 mb-3">
                {isSportsmanshipLeader && (
                  <span className="px-3 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-full text-xs font-bold text-amber-400 flex items-center gap-1">
                    <Star className="w-3 h-3" fill="currentColor" />
                    Sportsmanship Star
                  </span>
                )}
                {player.isCaptain && (
                  <span className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 rounded-full text-xs font-bold text-purple-400 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Team Captain
                  </span>
                )}
                {player.isStarter && (
                  <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-xs font-bold text-emerald-400">
                    Starter
                  </span>
                )}
              </div>
              
              {/* Name */}
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-1">
                {player.name}
              </h1>
              
              {/* Position & Team */}
              <p className="text-lg text-slate-400 mb-2">
                {player.position || 'TBD'} • {team?.name || 'Free Agent'} {(team as any)?.emoji || '🏈'}
              </p>
              
              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mb-4">
                {team?.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {team.city}, {team.state || 'GA'}
                  </span>
                )}
                {(player as any).classOf && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Class of {(player as any).classOf}
                  </span>
                )}
                {player.height && (
                  <span>{player.height} • {player.weight || '---'}lbs</span>
                )}
              </div>
              
              {/* Social Stats Bar */}
              <div className="flex items-center gap-6 py-3 px-4 bg-slate-800/50 backdrop-blur rounded-xl border border-white/5 mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{formatNumber(followerCount)}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Followers</div>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{formatNumber(recentGames.length)}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Games</div>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{formatNumber(filmRoom.length)}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Highlights</div>
                </div>
                <div className="w-px h-8 bg-slate-700" />
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{sportsmanshipPoints || 0}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Kudos</div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {userData?.role === 'Fan' && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                      isFollowing 
                        ? 'bg-slate-700 text-white hover:bg-slate-600' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30'
                    }`}
                  >
                    {followLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => setShowNILModal(true)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/30"
                >
                  <DollarSign className="w-4 h-4" />
                  NIL Inquiry
                </button>
                
                <button
                  onClick={() => showToast('Messages coming soon!', 'info')}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 border border-white/10"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
              </div>
            </div>
            
            {/* Season Stats Card - Right Side */}
            <div className="hidden xl:block w-72 flex-shrink-0">
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">{currentYear} Season</h3>
                  {team && (
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-medium">
                      {team.record?.wins || 0}-{team.record?.losses || 0} Record
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {keyStats.map((stat, i) => (
                    <div key={i} className="text-center p-3 bg-slate-900/50 rounded-xl">
                      <div className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        {stat.value}
                      </div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs Navigation */}
      <div className="sticky top-[60px] z-40 bg-slate-900/95 backdrop-blur-xl border-y border-white/10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
                {tab.count && tab.count > 0 && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <>
                {/* Hero Stats - Mobile View */}
                <div className="xl:hidden grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {keyStats.map((stat, i) => (
                    <div key={i} className="bg-slate-800/50 backdrop-blur rounded-2xl p-4 text-center border border-white/5">
                      <div className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        {stat.value}
                      </div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
                
                {/* Recent Games */}
                {recentGames.length > 0 && (
                  <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-white">{currentYear} Game Log</h2>
                      <span className="text-sm text-slate-500">{recentGames.length} games played</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/10">
                            <th className="text-left py-3 px-2">Game</th>
                            <th className="text-center py-3 px-2">Result</th>
                            <th className="text-center py-3 px-2">Stats</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentGames.map(({ game, stats }, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-3 px-2">
                                <div className="font-medium text-white">
                                  {game.isHome ? 'vs' : '@'} {game.opponent}
                                </div>
                                <div className="text-xs text-slate-500">{game.date}</div>
                              </td>
                              <td className="text-center py-3 px-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  (game as any).result === 'W' 
                                    ? 'bg-emerald-500/20 text-emerald-400' 
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {(game as any).result} {(game as any).score || ''}
                                </span>
                              </td>
                              <td className="text-center py-3 px-2 text-sm text-slate-300">
                                {(stats as any).passTd ? `${(stats as any).passTd} TD` : ''}
                                {(stats as any).rushTd ? `${(stats as any).rushTd} Rush TD` : ''}
                                {(stats as any).rec ? `${(stats as any).rec} Rec` : ''}
                                {(stats as any).tkl ? `${(stats as any).tkl} Tkl` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* Career Stats */}
                {careerStats.length > 0 && (
                  <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-bold text-white mb-4">Career Statistics</h2>
                    <div className="space-y-3">
                      {careerStats.map((season, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                          <div>
                            <div className="font-bold text-white">{season.season} Season</div>
                            <div className="text-sm text-slate-500">{season.teamName}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-indigo-400">
                              {(season.stats as any).passTd || (season.stats as any).rushTd || (season.stats as any).rec || (season.stats as any).tkl || 0}
                            </div>
                            <div className="text-xs text-slate-500">
                              {(season.stats as any).passTd ? 'Pass TDs' : 
                               (season.stats as any).rushTd ? 'Rush TDs' : 
                               (season.stats as any).rec ? 'Receptions' : 'Tackles'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h2 className="text-lg font-bold text-white mb-4">📝 Posts</h2>
                {teamId ? (
                  <AthletePosts teamId={teamId} playerId={player.id} player={player} />
                ) : (
                  <p className="text-slate-500 text-center py-8">No posts yet</p>
                )}
              </div>
            )}
            
            {/* Highlights Tab */}
            {activeTab === 'highlights' && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                  <h2 className="text-lg font-bold text-white mb-4">🎬 Film Room ({filmRoom.length})</h2>
                  
                  {filmRoom.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filmRoom.map((video) => (
                        <div key={video.id} className="group relative bg-slate-900/50 rounded-xl overflow-hidden border border-white/5 hover:border-indigo-500/50 transition-all">
                          <div className="aspect-video relative">
                            <img 
                              src={getYouTubeThumbnail(video.videoId)} 
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setPlayingVideoId(video.videoId)}
                                className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center"
                              >
                                <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                              </button>
                            </div>
                            <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
                              {(video as any).duration || '0:00'}
                            </span>
                          </div>
                          <div className="p-3">
                            <h4 className="font-medium text-white text-sm truncate">{video.title}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                              <Eye className="w-3 h-3" />
                              {(video as any).views || 0} views
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-8">No highlights yet</p>
                  )}
                </div>
                
                {/* Fan Clips */}
                {teamId && (
                  <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-bold text-white mb-4">🎥 Fan Clips</h2>
                    <FanClipGallery teamId={teamId} playerId={player.id} playerName={player.name} />
                  </div>
                )}
              </div>
            )}
            
            {/* Fundraising Tab */}
            {activeTab === 'fundraising' && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <h2 className="text-lg font-bold text-white mb-4">💰 Fundraising</h2>
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-700/50 rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 mb-4">No active fundraisers</p>
                  <p className="text-sm text-slate-500">
                    Check back later for fundraising campaigns
                  </p>
                </div>
              </div>
            )}
            
            {/* Chat Tab */}
            {activeTab === 'chat' && teamId && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h2 className="text-lg font-bold text-white">💬 Fan Chat</h2>
                </div>
                <PublicChat teamId={teamId} playerId={player.id} playerName={player.name} />
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Achievements Card */}
            {isSportsmanshipLeader && (
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl p-5 border border-amber-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-amber-500/30 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-400">Sportsmanship Star</h3>
                    <p className="text-xs text-amber-400/70">{sportsmanshipPoints} points earned</p>
                  </div>
                </div>
                <p className="text-sm text-amber-400/80">
                  Recognized for exceptional character on and off the field
                </p>
              </div>
            )}
            
            {/* Team Card */}
            {team && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Team</h3>
                <Link 
                  to={`/team/${teamId}`}
                  className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-xl hover:bg-slate-900/80 transition-colors"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">
                    {(team as any).emoji || '🏈'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white truncate">{team.name}</h4>
                    <p className="text-sm text-slate-500">
                      {(team as any).record?.wins || 0}-{(team as any).record?.losses || 0} • {(team as any).sportType || 'Football'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                </Link>
              </div>
            )}
            
            {/* Kudos Section */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Kudos</h3>
              {teamId ? (
                <AthleteKudos teamId={teamId} playerId={player.id} playerName={player.name} />
              ) : (
                <p className="text-slate-500 text-sm">No kudos yet</p>
              )}
            </div>
            
            {/* Quick Links */}
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Share Profile</h3>
              <div className="flex gap-2">
                {['📘', '🐦', '📸', '🔗'].map((icon, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      showToast('Link copied!', 'success');
                    }}
                    className="flex-1 h-12 bg-slate-900/50 hover:bg-slate-900 rounded-xl flex items-center justify-center text-xl transition-colors"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/10 mt-16 py-8 text-center">
        <p className="text-slate-500 text-sm">Powered by <span className="text-indigo-400 font-bold">OSYS</span></p>
        <p className="text-slate-600 text-xs mt-1">The Operating System for Youth Sports</p>
      </footer>
      
      {/* Video Modal */}
      {playingVideoId && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPlayingVideoId(null)}>
          <div className="relative w-full max-w-4xl aspect-video" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPlayingVideoId(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white"
            >
              <X className="w-8 h-8" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${playingVideoId}?autoplay=1`}
              className="w-full h-full rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
      
      {/* NIL Inquiry Modal */}
      {showNILModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNILModal(false)}>
          <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">💼 NIL Inquiry</h2>
              <button onClick={() => setShowNILModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Company/Brand Name *</label>
                <input
                  type="text"
                  value={nilForm.companyName}
                  onChange={e => setNilForm(f => ({ ...f, companyName: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="Your company name"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Deal Type</label>
                <select
                  value={nilForm.dealType}
                  onChange={e => setNilForm(f => ({ ...f, dealType: e.target.value as any }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="sponsorship">Sponsorship</option>
                  <option value="endorsement">Endorsement</option>
                  <option value="appearance">Appearance</option>
                  <option value="social_media">Social Media</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description *</label>
                <textarea
                  value={nilForm.description}
                  onChange={e => setNilForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  rows={3}
                  placeholder="Describe your proposal..."
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Estimated Value ($)</label>
                <input
                  type="number"
                  value={nilForm.estimatedValue}
                  onChange={e => setNilForm(f => ({ ...f, estimatedValue: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={nilForm.contactEmail}
                  onChange={e => setNilForm(f => ({ ...f, contactEmail: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  placeholder="your@email.com"
                />
              </div>
              
              <button
                onClick={handleNILInquiry}
                disabled={nilSubmitting}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {nilSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Inquiry
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicAthleteProfileV2;
