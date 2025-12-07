import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Users, Star, TrendingUp, Eye, ExternalLink, Search, Filter, User, Trophy, Calendar, Clock, AlertTriangle, FileText, MessageCircle } from 'lucide-react';
import type { Player, Team, LiveStream, AthletePost } from '../types';
import KudosLeaderboard from './public/KudosLeaderboard';

interface FollowedAthleteCard {
  player: Player;
  team: Team | null;
  teamId: string;
  recentActivity?: string;
}

interface TrendingAthlete {
  player: Player;
  team: Team | null;
  teamId: string;
  followerCount: number;
}

interface RecentPost {
  post: AthletePost;
  player: Player;
  team: Team | null;
  teamId: string;
}

const FanDashboard: React.FC = () => {
  const { user, userData } = useAuth();
  
  // Followed athletes
  const [followedAthletes, setFollowedAthletes] = useState<FollowedAthleteCard[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(true);
  
  // Trending athletes (top followed)
  const [trendingAthletes, setTrendingAthletes] = useState<TrendingAthlete[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  
  // Live streams from followed teams
  const [liveStreams, setLiveStreams] = useState<(LiveStream & { teamName: string })[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  
  // Recent posts from followed athletes
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FollowedAthleteCard[]>([]);
  const [searching, setSearching] = useState(false);

  // Load followed athletes
  useEffect(() => {
    const loadFollowedAthletes = async () => {
      if (!userData?.followedAthletes || userData.followedAthletes.length === 0) {
        setFollowedAthletes([]);
        setLoadingFollowed(false);
        return;
      }

      setLoadingFollowed(true);
      try {
        const athleteData: FollowedAthleteCard[] = [];
        
        for (const athleteKey of userData.followedAthletes.slice(0, 10)) { // Limit to 10 for dashboard
          const [teamId, playerId] = athleteKey.split('_');
          
          const playerDoc = await getDoc(doc(db, 'teams', teamId, 'players', playerId));
          if (playerDoc.exists()) {
            const player = { id: playerDoc.id, ...playerDoc.data() } as Player;
            
            const teamDoc = await getDoc(doc(db, 'teams', teamId));
            const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : null;
            
            athleteData.push({
              player,
              team,
              teamId
            });
          }
        }
        
        setFollowedAthletes(athleteData);
      } catch (err) {
        console.error('Error loading followed athletes:', err);
      } finally {
        setLoadingFollowed(false);
      }
    };

    loadFollowedAthletes();
  }, [userData?.followedAthletes]);

  // Load trending athletes (most followed)
  useEffect(() => {
    const loadTrendingAthletes = async () => {
      setLoadingTrending(true);
      try {
        // Get all teams first
        const teamsSnap = await getDocs(collection(db, 'teams'));
        const trending: TrendingAthlete[] = [];
        
        for (const teamDoc of teamsSnap.docs) {
          const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
          
          // Get players with follower counts
          const playersSnap = await getDocs(
            query(
              collection(db, 'teams', teamDoc.id, 'players'),
              where('followerCount', '>', 0),
              orderBy('followerCount', 'desc'),
              limit(5)
            )
          );
          
          for (const playerDoc of playersSnap.docs) {
            const player = { id: playerDoc.id, ...playerDoc.data() } as Player;
            trending.push({
              player,
              team,
              teamId: teamDoc.id,
              followerCount: player.followerCount || 0
            });
          }
        }
        
        // Sort by follower count and take top 6
        trending.sort((a, b) => b.followerCount - a.followerCount);
        setTrendingAthletes(trending.slice(0, 6));
      } catch (err) {
        console.error('Error loading trending athletes:', err);
      } finally {
        setLoadingTrending(false);
      }
    };

    loadTrendingAthletes();
  }, []);

  // Load live streams from followed teams
  useEffect(() => {
    if (!userData?.followedAthletes || userData.followedAthletes.length === 0) {
      setLiveStreams([]);
      setLoadingLive(false);
      return;
    }

    const loadLiveStreams = async () => {
      setLoadingLive(true);
      try {
        const teamIds = [...new Set(userData.followedAthletes.map((key: string) => key.split('_')[0]))];
        const streams: (LiveStream & { teamName: string })[] = [];
        
        for (const teamId of teamIds) {
          const teamDoc = await getDoc(doc(db, 'teams', teamId));
          if (!teamDoc.exists()) continue;
          
          const team = teamDoc.data() as Team;
          
          // Get active live streams
          const streamsSnap = await getDocs(
            query(
              collection(db, 'teams', teamId, 'liveStreams'),
              where('isActive', '==', true)
            )
          );
          
          for (const streamDoc of streamsSnap.docs) {
            const stream = { id: streamDoc.id, ...streamDoc.data() } as LiveStream;
            streams.push({
              ...stream,
              teamName: team.name
            });
          }
        }
        
        setLiveStreams(streams);
      } catch (err) {
        console.error('Error loading live streams:', err);
      } finally {
        setLoadingLive(false);
      }
    };

    loadLiveStreams();
  }, [userData?.followedAthletes]);

  // Load recent posts from followed athletes
  useEffect(() => {
    if (!userData?.followedAthletes || userData.followedAthletes.length === 0) {
      setRecentPosts([]);
      setLoadingPosts(false);
      return;
    }

    const loadRecentPosts = async () => {
      setLoadingPosts(true);
      try {
        const posts: RecentPost[] = [];
        
        // For each followed athlete, get their recent posts
        for (const followKey of userData.followedAthletes.slice(0, 10)) { // Limit to first 10 athletes
          const [teamId, playerId] = followKey.split('_');
          
          // Get team info
          const teamDoc = await getDoc(doc(db, 'teams', teamId));
          const team = teamDoc.exists() ? { id: teamDoc.id, ...teamDoc.data() } as Team : null;
          
          // Get player info
          const playerDoc = await getDoc(doc(db, 'teams', teamId, 'players', playerId));
          if (!playerDoc.exists()) continue;
          const player = { id: playerDoc.id, ...playerDoc.data() } as Player;
          
          // Get recent posts (last 3 per athlete)
          const postsSnap = await getDocs(
            query(
              collection(db, 'teams', teamId, 'players', playerId, 'posts'),
              orderBy('createdAt', 'desc'),
              limit(3)
            )
          );
          
          for (const postDoc of postsSnap.docs) {
            const post = { id: postDoc.id, ...postDoc.data() } as AthletePost;
            posts.push({ post, player, team, teamId });
          }
        }
        
        // Sort all posts by date and take top 10
        posts.sort((a, b) => {
          const aTime = a.post.createdAt?.toMillis?.() || 0;
          const bTime = b.post.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        
        setRecentPosts(posts.slice(0, 10));
      } catch (err) {
        console.error('Error loading recent posts:', err);
      } finally {
        setLoadingPosts(false);
      }
    };

    loadRecentPosts();
  }, [userData?.followedAthletes]);

  // Search athletes
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results: FollowedAthleteCard[] = [];
      const searchLower = searchQuery.toLowerCase();
      
      // Get all teams and search players
      const teamsSnap = await getDocs(collection(db, 'teams'));
      
      for (const teamDoc of teamsSnap.docs) {
        const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
        
        const playersSnap = await getDocs(collection(db, 'teams', teamDoc.id, 'players'));
        
        for (const playerDoc of playersSnap.docs) {
          const player = { id: playerDoc.id, ...playerDoc.data() } as Player;
          
          // Match by name or username
          if (
            player.name.toLowerCase().includes(searchLower) ||
            (player.username && player.username.toLowerCase().includes(searchLower))
          ) {
            results.push({
              player,
              team,
              teamId: teamDoc.id
            });
          }
        }
      }
      
      setSearchResults(results.slice(0, 10));
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setSearching(false);
    }
  };

  const navigateToAthleteProfile = (username?: string) => {
    if (username) {
      window.open(`/#/athlete/${username}`, '_blank');
    }
  };

  const navigateToTeamProfile = (teamId: string) => {
    window.open(`/#/team/${teamId}`, '_blank');
  };

  const isFollowing = (teamId: string, playerId: string): boolean => {
    const key = `${teamId}_${playerId}`;
    return userData?.followedAthletes?.includes(key) || false;
  };

  // Check if fan is banned
  if (userData?.isBanned) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-12">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-500/50 rounded-xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Account Suspended</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Your fan account has been suspended. Please contact support for more information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-100 dark:from-purple-600/20 to-pink-100 dark:to-pink-600/20 rounded-xl border border-purple-300 dark:border-purple-500/30 p-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          Welcome back, {userData?.name || 'Fan'}! 🎉
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Stay connected with your favorite athletes and never miss a moment.
        </p>
        
        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/30 px-3 py-2 rounded-lg">
            <Users className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            <span className="text-zinc-900 dark:text-white font-medium">{userData?.followedAthletes?.length || 0}</span>
            <span className="text-zinc-600 dark:text-zinc-400 text-sm">Following</span>
          </div>
          <div className="flex items-center gap-2 bg-white/50 dark:bg-black/30 px-3 py-2 rounded-lg">
            <Heart className="w-4 h-4 text-pink-500 dark:text-pink-400" />
            <span className="text-zinc-900 dark:text-white font-medium">
              {userData?.kudosGiven ? Object.values(userData.kudosGiven).reduce((sum: number, n: any) => sum + n, 0) : 0}
            </span>
            <span className="text-zinc-600 dark:text-zinc-400 text-sm">Kudos Given</span>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for athletes by name or username..."
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {searching && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            Search
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Search Results</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {searchResults.map((result) => (
                <div
                  key={`${result.teamId}_${result.player.id}`}
                  className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => navigateToAthleteProfile(result.player.username)}
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    {result.player.photoUrl ? (
                      <img src={result.player.photoUrl} alt={result.player.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                        <User size={18} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white truncate">{result.player.name}</span>
                      {isFollowing(result.teamId, result.player.id) && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-600/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">Following</span>
                      )}
                    </div>
                    {result.team && <span className="text-xs text-zinc-500 dark:text-zinc-400">{result.team.name}</span>}
                  </div>
                  <ExternalLink size={16} className="text-zinc-400 dark:text-zinc-500" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live Now Section */}
      {liveStreams.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-red-300 dark:border-red-500/30 p-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Live Now
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveStreams.map((stream) => (
              <a
                key={stream.id}
                href={stream.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">LIVE</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{stream.teamName}</span>
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-white">{stream.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Click to watch →</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recent Posts from Followed Athletes */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="text-blue-500 dark:text-blue-400" size={20} />
          Recent Posts
        </h2>

        {loadingPosts ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400">No recent posts</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Follow athletes to see their posts here!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentPosts.map((item) => (
              <div
                key={item.post.id}
                onClick={() => navigateToAthleteProfile(item.player.username)}
                className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-4 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                {/* Post Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    {item.player.photoUrl ? (
                      <img src={item.player.photoUrl} alt={item.player.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                        <User size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white">{item.player.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                      {item.team && <span>{item.team.name}</span>}
                      <span>•</span>
                      <span>{item.post.createdAt?.toDate ? new Date(item.post.createdAt.toDate()).toLocaleDateString() : 'Recently'}</span>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <p className="text-zinc-700 dark:text-zinc-300 text-sm line-clamp-3 mb-3">{item.post.text}</p>

                {/* Post Image Preview */}
                {item.post.imageUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden max-h-48">
                    <img src={item.post.imageUrl} alt="Post" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Post Stats */}
                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Heart size={14} className={item.post.likeCount > 0 ? 'text-red-400' : ''} />
                    <span>{item.post.likeCount || 0} likes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle size={14} />
                    <span>{item.post.commentCount || 0} comments</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Athletes You Follow */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="text-purple-500 dark:text-purple-400" size={20} />
            Athletes You Follow
          </h2>
          {followedAthletes.length > 0 && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{userData?.followedAthletes?.length || 0} total</span>
          )}
        </div>

        {loadingFollowed ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : followedAthletes.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400">You're not following any athletes yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Use the search above or check out trending athletes below!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {followedAthletes.map((athlete) => (
              <div
                key={`${athlete.teamId}_${athlete.player.id}`}
                onClick={() => navigateToAthleteProfile(athlete.player.username)}
                className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-3 text-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors group"
              >
                <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700 mx-auto mb-2 overflow-hidden ring-2 ring-purple-500/30 group-hover:ring-purple-500/60 transition-all">
                  {athlete.player.photoUrl ? (
                    <img src={athlete.player.photoUrl} alt={athlete.player.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                      <User size={24} />
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-white text-sm truncate">{athlete.player.name}</h3>
                {athlete.team && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{athlete.team.name}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trending Athletes */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="text-orange-500 dark:text-orange-400" size={20} />
          Trending Athletes
        </h2>

        {loadingTrending ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trendingAthletes.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400">No trending athletes yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Be the first to follow someone!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trendingAthletes.map((athlete, index) => (
              <div
                key={`${athlete.teamId}_${athlete.player.id}`}
                onClick={() => navigateToAthleteProfile(athlete.player.username)}
                className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                {/* Rank Badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-zinc-400 text-black' :
                  index === 2 ? 'bg-amber-700 text-white' :
                  'bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}>
                  {index + 1}
                </div>

                {/* Athlete Photo */}
                <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  {athlete.player.photoUrl ? (
                    <img src={athlete.player.photoUrl} alt={athlete.player.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                      <User size={20} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-zinc-900 dark:text-white truncate">{athlete.player.name}</h3>
                    {isFollowing(athlete.teamId, athlete.player.id) && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-600/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded flex-shrink-0">Following</span>
                    )}
                  </div>
                  {athlete.team && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{athlete.team.name}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <Users size={12} className="text-purple-500 dark:text-purple-400" />
                    <span className="text-xs text-purple-600 dark:text-purple-400">{athlete.followerCount} followers</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kudos Leaderboard */}
      <KudosLeaderboard 
        onAthleteClick={navigateToAthleteProfile}
        limit={10}
      />

      {/* Discover Teams */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <Trophy className="text-yellow-500 dark:text-yellow-400" size={20} />
          Discover Teams
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Explore team pages to find more athletes to follow and watch live games!
        </p>
        <button
          onClick={() => window.open('/teams', '_blank')}
          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2"
        >
          <Eye size={16} />
          Browse All Teams
        </button>
      </div>
    </div>
  );
};

export default FanDashboard;
