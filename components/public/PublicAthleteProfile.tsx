import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy, setDoc, deleteDoc, updateDoc, increment, Timestamp, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import type { Player, Team, PlayerSeasonStats, Game, GamePlayerStats, PlayerFilmEntry, AthleteFollower } from '../../types';
import { User, Trophy, Sword, Shield, Target, Activity, Calendar, MapPin, TrendingUp, Star, Zap, Crown, Users, ArrowLeft, Home, Award, Heart, Film, Play, X, ChevronRight, UserPlus, UserMinus, Loader2, MessageCircle, DollarSign, Briefcase, Send, Mail, Building2 } from 'lucide-react';
import PublicChat from './PublicChat';
import AthletePosts from './AthletePosts';
import AthleteKudos from './AthleteKudos';
import FanClipGallery from './FanClipGallery';
import { showToast } from '../../services/toast';

interface PublicAthleteData {
  player: Player;
  team: Team | null;
  teamId: string;
  seasonStats: PlayerSeasonStats | null;
  recentGames: { game: Game; stats: GamePlayerStats }[];
  careerStats: { season: number; teamName: string; stats: PlayerSeasonStats }[];
  isSportsmanshipLeader: boolean;
  sportsmanshipPoints: number;
  filmRoom: PlayerFilmEntry[];
}

const PublicAthleteProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [data, setData] = useState<PublicAthleteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilmRoom, setShowFilmRoom] = useState(false);
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
      const athleteKey = `${data.teamId}_${data.player.id}`;
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
    const athleteKey = `${data.teamId}_${data.player.id}`;
    
    try {
      if (isFollowing) {
        // Unfollow
        await updateDoc(doc(db, 'users', user.uid), {
          followedAthletes: arrayRemove(athleteKey)
        });
        
        // Remove from athlete's followers subcollection
        await deleteDoc(doc(db, 'teams', data.teamId, 'players', data.player.id, 'followers', user.uid));
        
        // Decrement follower count
        await updateDoc(doc(db, 'teams', data.teamId, 'players', data.player.id), {
          followerCount: increment(-1)
        });
        
        setFollowerCount(prev => Math.max(0, prev - 1));
        setIsFollowing(false);
      } else {
        // Follow
        await updateDoc(doc(db, 'users', user.uid), {
          followedAthletes: arrayUnion(athleteKey)
        });
        
        // Add to athlete's followers subcollection
        const followerData: AthleteFollower = {
          oddsId: user.uid,
          fanName: userData.name || 'Fan',
          fanUsername: userData.username || '',
          followedAt: Timestamp.now(),
          isVerified: false
        };
        await setDoc(doc(db, 'teams', data.teamId, 'players', data.player.id, 'followers', user.uid), followerData);
        
        // Increment follower count
        await updateDoc(doc(db, 'teams', data.teamId, 'players', data.player.id), {
          followerCount: increment(1)
        });
        
        setFollowerCount(prev => prev + 1);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
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
      // Create NIL deal inquiry (pending status)
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

  useEffect(() => {
    const fetchAthleteData = async () => {
      if (!username) {
        setError('No username provided');
        setLoading(false);
        return;
      }

      try {
        const normalizedUsername = username.toLowerCase();
        
        // Search for player across all teams by username
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        let foundPlayer: Player | null = null;
        let foundTeamId: string | null = null;

        for (const teamDoc of teamsSnapshot.docs) {
          const playersRef = collection(db, 'teams', teamDoc.id, 'players');
          const playersSnapshot = await getDocs(playersRef);
          
          for (const playerDoc of playersSnapshot.docs) {
            const playerData = playerDoc.data();
            if (playerData.username?.toLowerCase() === normalizedUsername) {
              foundPlayer = { id: playerDoc.id, ...playerData } as Player;
              foundTeamId = teamDoc.id;
              break;
            }
          }
          if (foundPlayer) break;
        }

        if (!foundPlayer || !foundTeamId) {
          setError('Athlete not found');
          setLoading(false);
          return;
        }

        // Get team data
        const teamDoc = await getDoc(doc(db, 'teams', foundTeamId));
        const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : null;

        // Get current season stats
        const currentYear = new Date().getFullYear();
        const seasonStatsId = `${foundPlayer.id}_${currentYear}`;
        const seasonStatsDoc = await getDoc(doc(db, 'teams', foundTeamId, 'seasonStats', seasonStatsId));
        const seasonStats = seasonStatsDoc.exists() 
          ? { id: seasonStatsDoc.id, ...seasonStatsDoc.data() } as PlayerSeasonStats 
          : null;

        // Get recent games with player stats
        const gamesQuery = query(
          collection(db, 'teams', foundTeamId, 'games'),
          where('season', '==', currentYear)
        );
        const gamesSnapshot = await getDocs(gamesQuery);
        const games = gamesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game));
        games.sort((a, b) => b.date.localeCompare(a.date));

        const recentGames: { game: Game; stats: GamePlayerStats }[] = [];
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

        // Get career stats (all seasons)
        const careerStats: { season: number; teamName: string; stats: PlayerSeasonStats }[] = [];
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

        // Check if this player is the sportsmanship leader for current season
        let isSportsmanshipLeader = false;
        let playerSportsmanshipPoints = (seasonStats as any)?.spts || 0;
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

        // Fetch player's film room (tagged videos)
        const filmRoomSnapshot = await getDocs(collection(db, 'teams', foundTeamId, 'players', foundPlayer.id, 'filmRoom'));
        const filmRoom = filmRoomSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PlayerFilmEntry));
        // Sort by taggedAt descending
        filmRoom.sort((a, b) => {
          const aTime = a.taggedAt?.toMillis?.() || 0;
          const bTime = b.taggedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

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

  // Format date helper
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-800/50 rounded-2xl p-8 text-center max-w-md border border-zinc-700">
          <User className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Athlete Not Found</h1>
          <p className="text-zinc-400 mb-6">
            The athlete profile you're looking for doesn't exist or has been removed.
          </p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            <Home className="w-5 h-5" />
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const { player, team, teamId, seasonStats, recentGames, careerStats, isSportsmanshipLeader, sportsmanshipPoints, filmRoom } = data;
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Header Bar */}
      <header className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tighter">
            <span className="text-orange-500">LOCKER</span>
            <span className="text-white">ROOM</span>
          </Link>
          <span className="text-xs text-zinc-500">Public Profile</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Sportsmanship Leader Banner */}
        {isSportsmanshipLeader && (
          <div className="sportsmanship-badge bg-gradient-to-r from-amber-900/50 via-orange-900/40 to-amber-900/50 rounded-xl border-2 border-amber-500/50 p-4 mb-6 relative overflow-hidden">
            <div className="absolute top-1 right-2 text-amber-400 sparkle-animation">
              <Star className="w-5 h-5" fill="currentColor" />
            </div>
            <div className="absolute bottom-1 left-2 text-amber-400/60 sparkle-animation-delay">
              <Star className="w-4 h-4" fill="currentColor" />
            </div>
            <div className="flex items-center justify-center gap-3">
              <Award className="w-8 h-8 text-amber-400 float-animation" />
              <div className="text-center">
                <h2 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  🏆 Team Sportsmanship Star 🏆
                </h2>
                <p className="text-amber-400/80 text-sm flex items-center justify-center gap-2 mt-1">
                  <Star className="w-4 h-4" fill="currentColor" />
                  <span className="font-bold text-amber-300">{sportsmanshipPoints}</span> sportsmanship points
                  <Heart className="w-4 h-4 text-amber-400" fill="currentColor" />
                </p>
              </div>
              <Award className="w-8 h-8 text-amber-400 float-animation" />
            </div>
            <p className="text-xs text-amber-400/60 italic text-center mt-2">
              ✨ Leading by example on and off the field ✨
            </p>
          </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 rounded-2xl p-6 md:p-8 border border-zinc-700/50 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Player Photo */}
            <div className="relative">
              {player.photoUrl ? (
                <img 
                  src={player.photoUrl} 
                  alt={player.name} 
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-orange-500 shadow-[0_0_30px_rgba(234,88,12,0.3)]"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center border-4 border-orange-500">
                  <User className="w-16 h-16 text-zinc-500" />
                </div>
              )}
              {player.isCaptain && (
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                  <Crown className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="text-center md:text-left flex-1 w-full">
              <h1 className="text-2xl md:text-4xl font-black text-white mb-1">{player.name}</h1>
              <p className="text-purple-400 font-medium text-sm md:text-base mb-2 md:mb-3">@{player.username}</p>
              
              <div className="flex flex-wrap justify-center md:justify-start gap-1.5 md:gap-2 mb-3 md:mb-4">
                {player.number && (
                  <span className="bg-orange-500 text-white px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-black">
                    #{player.number}
                  </span>
                )}
                {player.position && (
                  <span className="bg-zinc-700 text-zinc-200 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-medium">
                    {player.position}
                  </span>
                )}
                {player.isStarter && (
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" /> Starter
                  </span>
                )}
              </div>

              {team && (
                <a 
                  href={`#/team/${team.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{team.name}</span>
                </a>
              )}

              {/* Physical Stats */}
              {(player.height || player.weight) && (
                <div className="flex justify-center md:justify-start gap-4 mt-3 text-sm text-zinc-400">
                  {player.height && <span>Height: <strong className="text-white">{player.height}</strong></span>}
                  {player.weight && <span>Weight: <strong className="text-white">{player.weight}</strong></span>}
                </div>
              )}

              {/* Follower Count & Follow Button */}
              <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span><strong className="text-white">{followerCount}</strong> {followerCount === 1 ? 'follower' : 'followers'}</span>
                </div>
                
                {/* Follow Button - Only show for logged-in fans */}
                {userData?.role === 'Fan' && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                      isFollowing
                        ? 'bg-zinc-700 text-zinc-300 hover:bg-red-600 hover:text-white'
                        : 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                    }`}
                  >
                    {followLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        <span className="hidden sm:inline">Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Follow</span>
                      </>
                    )}
                  </button>
                )}
                
                {/* Prompt non-logged-in users to sign up */}
                {!user && (
                  <a
                    href="#/auth"
                    className="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-purple-600/30 transition-colors border border-purple-500/30"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign up to Follow</span>
                  </a>
                )}
                
                {/* NIL Deal Button - For logged-in users (sponsors/fans) */}
                {user && (
                  <button
                    onClick={() => setShowNILModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="hidden sm:inline">NIL Inquiry</span>
                  </button>
                )}
                
                {/* NIL prompt for non-logged-in users */}
                {!user && (
                  <a
                    href="#/auth"
                    className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="hidden sm:inline">Sign in for NIL</span>
                  </a>
                )}
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-black/40 rounded-xl p-4 border border-zinc-700 w-full md:w-auto md:min-w-[200px]">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 text-center">
                {currentYear} Season
              </p>
              <div className="grid grid-cols-4 md:grid-cols-2 gap-2 md:gap-3">
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-black text-orange-400">{seasonStats?.tds || 0}</p>
                  <p className="text-[10px] md:text-xs text-zinc-500">Touchdowns</p>
                </div>
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-black text-emerald-400">{seasonStats?.tackles || 0}</p>
                  <p className="text-[10px] md:text-xs text-zinc-500">Tackles</p>
                </div>
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-black text-cyan-400">{(seasonStats?.rushYards || 0) + (seasonStats?.recYards || 0)}</p>
                  <p className="text-[10px] md:text-xs text-zinc-500">Total Yards</p>
                </div>
                <div className="text-center">
                  <p className="text-xl md:text-2xl font-black text-purple-400">{seasonStats?.gp || 0}</p>
                  <p className="text-[10px] md:text-xs text-zinc-500">Games</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        {player.bio && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-500" />
              About {player.name.split(' ')[0]}
            </h2>
            <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">{player.bio}</p>
          </div>
        )}

        {/* Film Room Button */}
        {filmRoom.length > 0 && (
          <button
            onClick={() => setShowFilmRoom(true)}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl border border-red-500/30 p-5 flex items-center justify-between group transition-all hover:shadow-lg hover:shadow-orange-500/20 mb-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black/30 rounded-xl flex items-center justify-center">
                <Film className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-white">Film Room</h2>
                <p className="text-white/80 text-sm">{filmRoom.length} {filmRoom.length === 1 ? 'video' : 'videos'} • Game Film & Highlights</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-sm font-medium group-hover:text-white transition-colors hidden sm:inline">View All</span>
              <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        )}

        {/* Public Fan Chat */}
        <div className="mb-8">
          <PublicChat
            teamId={teamId}
            playerId={player.id}
            playerName={player.name}
            parentId={player.parentId}
          />
        </div>

        {/* Athlete Posts Feed */}
        <div className="mb-8">
          <AthletePosts
            teamId={teamId}
            playerId={player.id}
            player={player}
            parentId={player.parentId}
          />
        </div>

        {/* Athlete Kudos */}
        <div className="mb-8">
          <AthleteKudos
            teamId={teamId}
            playerId={player.id}
            playerName={player.name}
          />
        </div>

        {/* Fan Highlight Clips */}
        <div className="mb-8">
          <FanClipGallery
            teamId={teamId}
            playerId={player.id}
            playerName={player.name}
            parentId={player.parentId}
          />
        </div>

        {/* Season Stats */}
        {seasonStats && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              {currentYear} Season Statistics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Offense */}
              <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
                <h3 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Sword className="w-4 h-4" /> Offense
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Touchdowns</span>
                    <span className="font-bold text-white">{seasonStats.tds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Rushing Yards</span>
                    <span className="font-bold text-white">{seasonStats.rushYards}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Rush Attempts</span>
                    <span className="font-bold text-white">{seasonStats.rushAttempts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Receptions</span>
                    <span className="font-bold text-white">{seasonStats.rec}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Receiving Yards</span>
                    <span className="font-bold text-white">{seasonStats.recYards}</span>
                  </div>
                  {(seasonStats.passYards > 0 || seasonStats.passCompletions > 0) && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Pass Yards</span>
                        <span className="font-bold text-white">{seasonStats.passYards}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Completions</span>
                        <span className="font-bold text-white">{seasonStats.passCompletions}/{seasonStats.passAttempts}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Defense */}
              <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Shield className="w-4 h-4" /> Defense
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Total Tackles</span>
                    <span className="font-bold text-white">{seasonStats.tackles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Solo Tackles</span>
                    <span className="font-bold text-white">{seasonStats.soloTackles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Assists</span>
                    <span className="font-bold text-white">{seasonStats.assistTackles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Sacks</span>
                    <span className="font-bold text-white">{seasonStats.sacks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Interceptions</span>
                    <span className="font-bold text-white">{seasonStats.int}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Forced Fumbles</span>
                    <span className="font-bold text-white">{seasonStats.ff}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Fumble Recoveries</span>
                    <span className="font-bold text-white">{seasonStats.fr}</span>
                  </div>
                </div>
              </div>

              {/* Special Teams */}
              <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Zap className="w-4 h-4" /> Special Teams
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Kick Return Yards</span>
                    <span className="font-bold text-white">{seasonStats.kickReturnYards}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Kick Return TDs</span>
                    <span className="font-bold text-white">{seasonStats.kickReturnTds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Punt Return Yards</span>
                    <span className="font-bold text-white">{seasonStats.puntReturnYards}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Punt Return TDs</span>
                    <span className="font-bold text-white">{seasonStats.puntReturnTds}</span>
                  </div>
                </div>
                
                {/* Sportsmanship */}
                <div className="mt-4 pt-4 border-t border-yellow-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Star className="w-3 h-3 text-pink-400" /> Sportsmanship
                    </span>
                    <span className="font-bold text-pink-400">{seasonStats.spts}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Games */}
        {recentGames.length > 0 && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              Recent Game Performances
            </h2>
            
            <div className="space-y-3">
              {recentGames.map(({ game, stats }) => {
                const resultColor = game.result === 'W' ? 'text-emerald-400' : game.result === 'L' ? 'text-red-400' : 'text-yellow-400';
                const resultBg = game.result === 'W' ? 'bg-emerald-500' : game.result === 'L' ? 'bg-red-500' : 'bg-yellow-500';
                
                return (
                  <div key={game.id} className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 ${resultBg} rounded flex items-center justify-center text-white font-black text-sm`}>
                          {game.result}
                        </div>
                        <div>
                          <p className="font-bold text-white">{game.isHome ? 'vs' : '@'} {game.opponent}</p>
                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatDate(game.date)}
                          </p>
                        </div>
                      </div>
                      <p className={`text-xl font-black ${resultColor}`}>
                        {game.teamScore} - {game.opponentScore}
                      </p>
                    </div>
                    
                    {/* Game Stats */}
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-center">
                      {stats.tds > 0 && (
                        <div className="bg-orange-500/20 rounded p-2">
                          <p className="text-lg font-bold text-orange-400">{stats.tds}</p>
                          <p className="text-[10px] text-zinc-500">TD</p>
                        </div>
                      )}
                      {stats.rushYards > 0 && (
                        <div className="bg-zinc-700/50 rounded p-2">
                          <p className="text-lg font-bold text-white">{stats.rushYards}</p>
                          <p className="text-[10px] text-zinc-500">RuYd</p>
                        </div>
                      )}
                      {stats.recYards > 0 && (
                        <div className="bg-zinc-700/50 rounded p-2">
                          <p className="text-lg font-bold text-white">{stats.recYards}</p>
                          <p className="text-[10px] text-zinc-500">ReYd</p>
                        </div>
                      )}
                      {stats.rec > 0 && (
                        <div className="bg-zinc-700/50 rounded p-2">
                          <p className="text-lg font-bold text-white">{stats.rec}</p>
                          <p className="text-[10px] text-zinc-500">Rec</p>
                        </div>
                      )}
                      {stats.tackles > 0 && (
                        <div className="bg-emerald-500/20 rounded p-2">
                          <p className="text-lg font-bold text-emerald-400">{stats.tackles}</p>
                          <p className="text-[10px] text-zinc-500">Tkl</p>
                        </div>
                      )}
                      {stats.sacks > 0 && (
                        <div className="bg-purple-500/20 rounded p-2">
                          <p className="text-lg font-bold text-purple-400">{stats.sacks}</p>
                          <p className="text-[10px] text-zinc-500">Sack</p>
                        </div>
                      )}
                      {stats.int > 0 && (
                        <div className="bg-red-500/20 rounded p-2">
                          <p className="text-lg font-bold text-red-400">{stats.int}</p>
                          <p className="text-[10px] text-zinc-500">INT</p>
                        </div>
                      )}
                      {stats.ff > 0 && (
                        <div className="bg-orange-500/20 rounded p-2">
                          <p className="text-lg font-bold text-orange-400">{stats.ff}</p>
                          <p className="text-[10px] text-zinc-500">FF</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Career Stats */}
        {careerStats.length > 1 && (
          <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Career History
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left border-b border-zinc-700">
                    <th className="pb-2 font-medium">Season</th>
                    <th className="pb-2 font-medium">Team</th>
                    <th className="pb-2 font-medium text-center">GP</th>
                    <th className="pb-2 font-medium text-center">TD</th>
                    <th className="pb-2 font-medium text-center">RuYd</th>
                    <th className="pb-2 font-medium text-center">ReYd</th>
                    <th className="pb-2 font-medium text-center">Tkl</th>
                    <th className="pb-2 font-medium text-center">INT</th>
                  </tr>
                </thead>
                <tbody>
                  {careerStats.map((career) => (
                    <tr key={career.season} className="border-b border-zinc-800 text-zinc-300">
                      <td className="py-2 font-bold text-white">{career.season}</td>
                      <td className="py-2">{career.teamName}</td>
                      <td className="py-2 text-center">{career.stats.gp}</td>
                      <td className="py-2 text-center text-orange-400 font-bold">{career.stats.tds}</td>
                      <td className="py-2 text-center">{career.stats.rushYards}</td>
                      <td className="py-2 text-center">{career.stats.recYards}</td>
                      <td className="py-2 text-center text-emerald-400">{career.stats.tackles}</td>
                      <td className="py-2 text-center text-red-400">{career.stats.int}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-zinc-600 text-sm">
          <p>Powered by <span className="text-purple-500 font-bold">OSYS</span></p>
        </footer>
      </main>

      {/* Film Room Modal */}
      {showFilmRoom && filmRoom.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
          <div className="min-h-full p-4 md:p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl flex items-center justify-center">
                    <Film className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{player.name}'s Film Room</h2>
                    <p className="text-zinc-400">{filmRoom.length} {filmRoom.length === 1 ? 'video' : 'videos'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilmRoom(false)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Video Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filmRoom.map((video) => (
                <div 
                  key={video.id}
                  className="group bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer"
                  onClick={() => setPlayingVideoId(video.youtubeId)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black">
                    <img 
                      src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      <div className="w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="w-7 h-7 text-white ml-1" />
                      </div>
                    </div>
                    {/* Category Badge */}
                    <div className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold ${
                      video.category === 'Game Film' ? 'bg-red-500/90' : 'bg-yellow-500/90'
                    } text-white`}>
                      {video.category}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-white line-clamp-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{video.description}</p>
                    )}
                    {video.teamName && (
                      <p className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
                        <Users className="w-3 h-3" /> {video.teamName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {playingVideoId && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-300">
          <div className="w-full max-w-6xl relative aspect-video bg-black shadow-2xl rounded-lg overflow-hidden">
            {/* Close Button */}
            <button 
              onClick={() => setPlayingVideoId(null)} 
              className="absolute top-4 right-4 z-10 bg-black/50 text-white hover:bg-orange-600 p-2 rounded-full transition-colors backdrop-blur-sm"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* YouTube Embed */}
            <iframe 
              src={`https://www.youtube.com/embed/${playingVideoId}?autoplay=1&rel=0&modestbranding=1`} 
              title="YouTube video player" 
              className="w-full h-full"
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* NIL Inquiry Modal */}
      {showNILModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowNILModal(false)}>
          <div 
            className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-700 shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">NIL Inquiry</h2>
                    <p className="text-white/80 text-sm">Contact {data?.player.name.split(' ')[0]} for a deal</p>
                  </div>
                </div>
                <button onClick={() => setShowNILModal(false)} className="text-white/80 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Company Name */}
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">Your Company/Organization *</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={nilForm.companyName}
                    onChange={e => setNilForm(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="ACME Sports Shop"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Deal Type */}
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">Type of Deal *</label>
                <select
                  value={nilForm.dealType}
                  onChange={e => setNilForm(prev => ({ ...prev, dealType: e.target.value as any }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white"
                >
                  <option value="sponsorship">Sponsorship</option>
                  <option value="social_media">Social Media Promotion</option>
                  <option value="appearance">Appearance / Event</option>
                  <option value="merchandise">Merchandise / Autographs</option>
                  <option value="camp">Camp / Training</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">Describe Your Proposal *</label>
                <textarea
                  value={nilForm.description}
                  onChange={e => setNilForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell us about the opportunity, what you'd like the athlete to do, and any other details..."
                  rows={4}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 resize-none"
                />
              </div>

              {/* Estimated Value */}
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">Estimated Value ($) <span className="text-zinc-500 font-normal">(optional)</span></label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="number"
                    value={nilForm.estimatedValue}
                    onChange={e => setNilForm(prev => ({ ...prev, estimatedValue: e.target.value }))}
                    placeholder="500"
                    min="0"
                    step="0.01"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Contact Email */}
              <div>
                <label className="text-sm font-medium text-zinc-300 block mb-2">Your Contact Email *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="email"
                    value={nilForm.contactEmail}
                    onChange={e => setNilForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="you@company.com"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-zinc-500"
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-400">
                <p className="font-medium mb-1">📋 What happens next?</p>
                <p className="text-amber-400/80">
                  Your inquiry will be sent to the athlete and their parent/guardian for review. 
                  They'll contact you directly if interested.
                </p>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleNILInquiry}
                disabled={nilSubmitting || !nilForm.companyName.trim() || !nilForm.description.trim()}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {nilSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send NIL Inquiry
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

export default PublicAthleteProfile;
