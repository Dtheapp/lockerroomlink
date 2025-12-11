import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Player, Team, PlayerSeasonStats, Game, TeamEvent, UserProfile, Video, LiveStream } from '../../types';
import { Users, Trophy, Calendar, MapPin, Clock, User, Crown, Star, Shield, Sword, TrendingUp, ChevronRight, Home, X, Heart, Award, Film, Play, Radio, CheckCircle, Target, Zap, Share2, Bell } from 'lucide-react';
import { LiveStreamBanner, LiveStreamViewer } from '../livestream';
import { AnimatedBackground, GlassCard } from '../ui/OSYSComponents';

interface TeamCoach {
  id: string;
  username?: string;
  name: string;
  email?: string;
  isHeadCoach?: boolean;
  photoUrl?: string;
}

interface SportsmanshipLeader {
  player: Player;
  sportsmanshipPoints: number;
}

interface PublicTeamData {
  team: Team;
  coaches: TeamCoach[];
  players: Player[];
  games: Game[];
  upcomingEvents: TeamEvent[];
  publicVideos: Video[];
  seasonRecord: { wins: number; losses: number; ties: number };
  seasonStats: {
    totalTds: number;
    totalRushYards: number;
    totalPassYards: number;
    totalTackles: number;
  };
  sportsmanshipLeader: SportsmanshipLeader | null;
}

const PublicTeamProfile: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [data, setData] = useState<PublicTeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [showFilmRoom, setShowFilmRoom] = useState(false);
  
  // Live stream state
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [showLiveStreamViewer, setShowLiveStreamViewer] = useState(false);

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!teamId) {
        setError('No team ID provided');
        setLoading(false);
        return;
      }

      try {
        // Try to get team document (try both original case and uppercase for backward compatibility)
        let teamDoc = await getDoc(doc(db, 'teams', teamId));
        
        // If not found, try uppercase (teams created in admin panel are uppercase)
        if (!teamDoc.exists()) {
          teamDoc = await getDoc(doc(db, 'teams', teamId.toUpperCase()));
        }
        
        // Still not found? Try lowercase
        if (!teamDoc.exists()) {
          teamDoc = await getDoc(doc(db, 'teams', teamId.toLowerCase()));
        }
        
        if (!teamDoc.exists()) {
          setError('Team not found');
          setLoading(false);
          return;
        }

        const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
        const actualTeamId = teamDoc.id; // Use the actual team ID from the document
        const currentYear = new Date().getFullYear();

        // Get coaches for this team
        const coachesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'Coach')
        );
        const coachesSnapshot = await getDocs(coachesQuery);
        const coaches: TeamCoach[] = [];
        
        coachesSnapshot.docs.forEach(coachDoc => {
          const coachData = coachDoc.data() as UserProfile;
          // Check if coach belongs to this team (either as primary or in teamIds array)
          const belongsToTeam = coachData.teamId === actualTeamId || 
            (coachData.teamIds && coachData.teamIds.includes(actualTeamId));
          
          if (belongsToTeam) {
            coaches.push({
              id: coachDoc.id,
              username: coachData.username,
              name: coachData.name,
              email: coachData.email,
              isHeadCoach: team.headCoachId === coachDoc.id || team.coachId === coachDoc.id,
              photoUrl: coachData.photoUrl
            });
          }
        });

        // Sort coaches - head coach first
        coaches.sort((a, b) => (b.isHeadCoach ? 1 : 0) - (a.isHeadCoach ? 1 : 0));

        // Get players
        const playersSnapshot = await getDocs(collection(db, 'teams', actualTeamId, 'players'));
        const players = playersSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Player))
          .sort((a, b) => (a.number || 999) - (b.number || 999));

        // Get games for current season
        const gamesQuery = query(
          collection(db, 'teams', actualTeamId, 'games'),
          where('season', '==', currentYear)
        );
        const gamesSnapshot = await getDocs(gamesQuery);
        const games = gamesSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .sort((a, b) => b.date.localeCompare(a.date));

        // Calculate season record
        const seasonRecord = {
          wins: games.filter(g => g.result === 'W').length,
          losses: games.filter(g => g.result === 'L').length,
          ties: games.filter(g => g.result === 'T').length
        };

        // Get upcoming events
        const today = new Date().toISOString().split('T')[0];
        const eventsQuery = query(collection(db, 'teams', actualTeamId, 'events'));
        const eventsSnapshot = await getDocs(eventsQuery);
        const upcomingEvents = eventsSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as TeamEvent))
          .filter(e => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);

        // Get aggregated season stats and find sportsmanship leader
        const seasonStatsSnapshot = await getDocs(collection(db, 'teams', actualTeamId, 'seasonStats'));
        let totalTds = 0, totalRushYards = 0, totalPassYards = 0, totalTackles = 0;
        let topSportsmanshipPoints = 0;
        let topSportsmanshipPlayerId: string | null = null;
        
        seasonStatsSnapshot.docs.forEach(statDoc => {
          const stats = statDoc.data() as PlayerSeasonStats;
          if (stats.season === currentYear) {
            totalTds += stats.tds || 0;
            totalRushYards += stats.rushYards || 0;
            totalPassYards += stats.passYards || 0;
            totalTackles += stats.tackles || 0;
            
            // Track sportsmanship leader (spts field)
            const spts = (stats as any).spts || 0;
            if (spts > topSportsmanshipPoints) {
              topSportsmanshipPoints = spts;
              topSportsmanshipPlayerId = stats.playerId;
            }
          }
        });

        // Find the sportsmanship leader player data
        let sportsmanshipLeader: SportsmanshipLeader | null = null;
        if (topSportsmanshipPlayerId && topSportsmanshipPoints > 0) {
          const leaderPlayer = players.find(p => p.id === topSportsmanshipPlayerId);
          if (leaderPlayer) {
            sportsmanshipLeader = {
              player: leaderPlayer,
              sportsmanshipPoints: topSportsmanshipPoints
            };
          }
        }

        // Get public videos (only videos marked as public and NOT private player videos)
        // Note: Fetching all and filtering client-side to avoid needing composite index
        let publicVideos: Video[] = [];
        try {
          const videosSnapshot = await getDocs(collection(db, 'teams', actualTeamId, 'videos'));
          publicVideos = videosSnapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Video))
            .filter(v => v.isPublic === true && !v.playerId) // Only public team videos
            .sort((a, b) => {
              // Sort by createdAt descending
              const aTime = a.createdAt?.toMillis?.() || 0;
              const bTime = b.createdAt?.toMillis?.() || 0;
              return bTime - aTime;
            });
        } catch (err) {
          console.error('Error fetching videos:', err);
          // Continue without videos if there's an error
        }

        setData({
          team,
          coaches,
          players,
          games,
          upcomingEvents,
          publicVideos,
          seasonRecord,
          seasonStats: { totalTds, totalRushYards, totalPassYards, totalTackles },
          sportsmanshipLeader
        });
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError('Failed to load team profile');
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
  }, [teamId]);

  // Live streams listener for PUBLIC streams only
  // Uses data?.team?.id to get the actual team ID after it's resolved (handles case-insensitivity)
  useEffect(() => {
    const actualTeamId = data?.team?.id;
    if (!actualTeamId) return;
    
    // Listen for active PUBLIC live streams for this team
    const liveStreamsQuery = query(
      collection(db, 'teams', actualTeamId, 'liveStreams'),
      where('isLive', '==', true),
      where('visibility', '==', 'public')
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
  }, [data?.team?.id]);

  // Format date helper
  const formatDate = (dateStr: string, options?: Intl.DateTimeFormatOptions) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', options || { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Format time helper
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="osys-bg">
          <div className="osys-bg-gradient"></div>
          <div className="osys-bg-mesh"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-20 h-20 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400 animate-pulse">Loading team...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="osys-bg">
          <div className="osys-bg-gradient"></div>
          <div className="osys-bg-mesh"></div>
        </div>
        <div className="relative z-10 osys-glass bg-slate-900/60 backdrop-blur-xl rounded-2xl p-8 text-center max-w-md border border-white/10 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 mx-auto mb-4 flex items-center justify-center">
            <Users className="w-8 h-8 text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Team Not Found</h1>
          <p className="text-slate-400 mb-6">
            The team profile you're looking for doesn't exist or has been removed.
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

  const { team, coaches, players, games, upcomingEvents, publicVideos, seasonRecord, seasonStats, sportsmanshipLeader } = data;
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Header Nav - Glass */}
      <nav className="fixed top-0 left-0 right-0 z-50 mx-4 mt-4">
        <div className="max-w-6xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 flex items-center justify-between shadow-2xl">
          <Link to="/" className="flex items-center gap-3 text-xl font-black tracking-tight">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">OSYS</span>
          </Link>
          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Team Header Banner */}
      <header className="relative pt-24 pb-8">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        
        <div className="relative max-w-6xl mx-auto px-4">
          {/* Team Info Card */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Team Logo/Emoji */}
              <div className="w-28 h-28 lg:w-36 lg:h-36 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 border-4 border-white/20">
                <span className="text-5xl lg:text-6xl">{team.emoji || '🏈'}</span>
              </div>
              
              {/* Team Details */}
              <div className="flex-1 text-center lg:text-left">
                <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-3">
                  {seasonRecord.wins > 0 && (
                    <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold">
                      🏆 {seasonRecord.wins}-{seasonRecord.losses} Record
                    </span>
                  )}
                  <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Verified Team
                  </span>
                </div>
                
                <h1 className="text-4xl lg:text-5xl font-black text-white mb-2 tracking-tight">{team.name}</h1>
                <p className="text-slate-400 text-lg mb-6">
                  {team.sport || 'Football'} • {team.location || 'Location TBD'} • {currentYear} Season
                </p>
                
                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                  <button className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 flex items-center gap-2">
                    <Heart className="w-5 h-5" /> Follow Team
                  </button>
                  <button className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:scale-105 flex items-center gap-2">
                    💰 Support
                  </button>
                  <button className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/10 transition-all">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                  <p className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    {seasonRecord.wins}-{seasonRecord.losses}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Record</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                  <p className="text-3xl font-black bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                    {seasonStats.totalTds}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Team TDs</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                  <p className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    {seasonStats.totalRushYards + seasonStats.totalPassYards}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Total Yards</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center min-w-[100px]">
                  <p className="text-3xl font-black bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                    {players.length}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Players</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Live Stream Banner - Shows when there are PUBLIC live streams */}
        {liveStreams.length > 0 && (
          <div className="mb-8">
            <LiveStreamBanner
              streams={liveStreams}
              teamName={team.name}
              onClick={() => setShowLiveStreamViewer(true)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Film Room Button - at the top, only shows if videos exist */}
            {publicVideos.length > 0 && (
              <button
                onClick={() => setShowFilmRoom(true)}
                className="w-full bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 rounded-2xl p-6 flex items-center justify-between group transition-all hover:shadow-2xl hover:shadow-orange-500/20 hover:scale-[1.02]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-black/30 rounded-xl flex items-center justify-center">
                    <Film className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-white">🎬 Film Room</h2>
                    <p className="text-white/80 text-sm">{publicVideos.length} {publicVideos.length === 1 ? 'video' : 'videos'} • Game Film & Highlights</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/80 text-sm font-medium group-hover:text-white transition-colors hidden sm:inline">View All</span>
                  <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            )}

            {/* Coaching Staff */}
            {coaches.length > 0 && (
              <GlassCard className="!bg-slate-900/60 !border-white/10">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  Coaching Staff
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coaches.map((coach) => (
                    <a 
                      key={coach.id}
                      href={`#/coach/${coach.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 p-4 rounded-xl transition-all hover:scale-[1.02] ${
                        coach.isHeadCoach 
                          ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:border-amber-400' 
                          : 'bg-slate-800/50 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {coach.photoUrl ? (
                        <img 
                          src={coach.photoUrl} 
                          alt={coach.name}
                          className={`w-12 h-12 rounded-xl object-cover border-2 ${
                            coach.isHeadCoach ? 'border-amber-500' : 'border-slate-600'
                          }`}
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          coach.isHeadCoach ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-slate-700'
                        }`}>
                          <User className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{coach.name}</p>
                        <p className="text-xs text-slate-500">
                          {coach.isHeadCoach ? '👑 Head Coach' : 'Coach'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Team Roster */}
            <GlassCard className="!bg-slate-900/60 !border-white/10">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Team Roster
                <span className="ml-auto text-sm font-normal text-slate-500">{players.length} players</span>
              </h2>
              {players.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No players on roster yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {players.map((player) => (
                    <a
                      key={player.id}
                      href={player.username ? `#/athlete/${player.username}` : '#'}
                      target={player.username ? "_blank" : undefined}
                      rel={player.username ? "noopener noreferrer" : undefined}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        player.username 
                          ? 'bg-slate-800/50 hover:bg-slate-700/50 border border-white/5 hover:border-indigo-500/30 cursor-pointer hover:scale-[1.02]' 
                          : 'bg-slate-800/30 border border-white/5 cursor-default opacity-60'
                      } ${player.isStarter ? 'ring-2 ring-indigo-500/50' : ''}`}
                      onClick={!player.username ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                    >
                      {player.photoUrl ? (
                        <img src={player.photoUrl} alt={player.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-lg font-bold text-white">
                          {player.number || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate flex items-center gap-1">
                          {player.name}
                          {player.isCaptain && <span className="text-amber-400">👑</span>}
                          {player.isStarter && <Star className="w-3 h-3 text-indigo-400" />}
                        </p>
                        <p className="text-xs text-slate-500">
                          #{player.number || '?'} • {player.position || 'N/A'}
                        </p>
                      </div>
                      {player.username && (
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      )}
                    </a>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Game Results */}
            {games.length > 0 && (
              <GlassCard className="!bg-slate-900/60 !border-white/10">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  {currentYear} Schedule & Results
                </h2>
                <div className="space-y-2">
                  {games.map((game) => {
                    const isWin = game.result === 'W';
                    const isLoss = game.result === 'L';
                    
                    return (
                      <div key={game.id} className={`flex items-center justify-between rounded-xl p-4 border transition-all ${
                        isWin ? 'bg-emerald-500/10 border-emerald-500/20' : 
                        isLoss ? 'bg-rose-500/10 border-rose-500/20' : 
                        'bg-slate-800/50 border-white/10'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[50px]">
                            <p className="text-xs text-slate-500 uppercase">{formatDate(game.date, { month: 'short' })}</p>
                            <p className="text-xl font-bold text-white">{formatDate(game.date, { day: 'numeric' })}</p>
                          </div>
                          <div>
                            <p className="font-bold text-white">
                              {game.isHome ? 'vs.' : '@'} {game.opponent}
                            </p>
                            <p className="text-xs text-slate-500">{game.isHome ? 'Home' : 'Away'}</p>
                          </div>
                        </div>
                        {game.result ? (
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                              isWin ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                            }`}>
                              {game.result}
                            </span>
                            <span className="text-xl font-black text-white">
                              {game.teamScore}-{game.opponentScore}
                            </span>
                          </div>
                        ) : (
                          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-lg text-sm font-bold">
                            Upcoming
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sportsmanship Star */}
            {sportsmanshipLeader && sportsmanshipLeader.player.username && (
              <a 
                href={`#/athlete/${sportsmanshipLeader.player.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block sportsmanship-card bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-amber-900/40 backdrop-blur-xl rounded-2xl border-2 border-amber-500/50 p-6 relative overflow-hidden transition-all duration-300 cursor-pointer hover:border-amber-400 hover:scale-[1.02] hover:shadow-2xl hover:shadow-amber-500/20"
              >
                {/* Sparkle decorations with animations */}
                <div className="absolute top-2 right-2 text-amber-400 sparkle-animation">
                  <Star className="w-6 h-6" fill="currentColor" />
                </div>
                <div className="absolute bottom-2 left-2 text-amber-400/60 sparkle-animation-delay">
                  <Star className="w-4 h-4" fill="currentColor" />
                </div>
                
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                    ⭐ Sportsmanship Star
                  </span>
                </h2>
                
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {sportsmanshipLeader.player.photoUrl ? (
                      <img 
                        src={sportsmanshipLeader.player.photoUrl} 
                        alt={sportsmanshipLeader.player.name}
                        className="w-16 h-16 rounded-xl object-cover border-2 border-amber-400 shadow-lg shadow-amber-500/30"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center border-2 border-amber-400 shadow-lg shadow-amber-500/30">
                        <span className="text-white font-bold text-xl">
                          {sportsmanshipLeader.player.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-slate-900">
                      <Heart className="w-3 h-3 text-slate-900" fill="currentColor" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-lg truncate">{sportsmanshipLeader.player.name}</p>
                    <p className="text-amber-400/80 text-sm">
                      #{sportsmanshipLeader.player.number || '--'} • {sportsmanshipLeader.player.position || 'Player'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                      <span className="text-amber-300 font-bold text-lg">{sportsmanshipLeader.sportsmanshipPoints}</span>
                      <span className="text-amber-400/60 text-xs">pts</span>
                    </div>
                  </div>
                </div>
              </a>
            )}

            {/* Top Performers */}
            <GlassCard className="!bg-slate-900/60 !border-white/10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Top Performers
              </h2>
              <div className="space-y-3">
                {players
                  .filter(p => (p.stats?.td || 0) + (p.stats?.tkl || 0) > 0)
                  .sort((a, b) => ((b.stats?.td || 0) + (b.stats?.tkl || 0)) - ((a.stats?.td || 0) + (a.stats?.tkl || 0)))
                  .slice(0, 5)
                  .map((player, index) => (
                    <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 
                        index === 1 ? 'bg-slate-600 text-white' :
                        index === 2 ? 'bg-amber-800 text-white' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{player.name}</p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded font-bold">{player.stats?.td || 0} TD</span>
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded font-bold">{player.stats?.tkl || 0} TKL</span>
                      </div>
                    </div>
                  ))}
                {players.filter(p => (p.stats?.td || 0) + (p.stats?.tkl || 0) > 0).length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-4">No stats recorded yet.</p>
                )}
              </div>
            </GlassCard>

            {/* Upcoming Events */}
            <GlassCard className="!bg-slate-900/60 !border-white/10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                Upcoming Events
              </h2>
              {upcomingEvents.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No upcoming events scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event, index) => {
                    const typeEmoji = event.type === 'Game' ? '🏈' : event.type === 'Practice' ? '🏃' : '📅';
                    
                    return (
                      <div 
                        key={event.id} 
                        className={`rounded-xl p-4 border transition-all cursor-pointer hover:scale-[1.02] ${
                          index === 0 
                            ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/30' 
                            : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                        }`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">{typeEmoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm truncate">{event.title}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(event.date)}
                              {event.time && ` • ${formatTime(event.time)}`}
                            </p>
                            {event.location && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </p>
                            )}
                          </div>
                          {index === 0 && (
                            <span className="px-2 py-1 bg-indigo-500 text-white text-xs font-bold rounded">Next</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center py-8 border-t border-white/10">
          <p className="text-slate-500 text-sm">
            Powered by <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold">OSYS</span>
          </p>
          <p className="text-slate-600 text-xs mt-1">The Operating System for Youth Sports</p>
        </footer>
      </main>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="osys-glass bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-6 border-b border-white/10">
              <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${
                selectedEvent.type === 'Game' ? 'bg-gradient-to-r from-orange-500 to-red-500' : 
                selectedEvent.type === 'Practice' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 
                'bg-gradient-to-r from-indigo-500 to-purple-500'
              }`} />
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
              <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold mb-3 ${
                selectedEvent.type === 'Game' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 
                selectedEvent.type === 'Practice' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              }`}>
                {selectedEvent.type === 'Game' ? '🏈' : selectedEvent.type === 'Practice' ? '🏃' : '📅'} {selectedEvent.type}
              </span>
              <h3 className="text-xl font-bold text-white pr-8">{selectedEvent.title}</h3>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-white font-medium">
                    {formatDate(selectedEvent.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  {selectedEvent.time && (
                    <p className="text-slate-400 text-sm flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(selectedEvent.time)}
                    </p>
                  )}
                </div>
              </div>

              {/* Location */}
              {selectedEvent.location && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{selectedEvent.location}</p>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Details</h4>
                  <p className="text-white text-sm leading-relaxed">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Film Room Modal */}
      {showFilmRoom && publicVideos.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 overflow-y-auto">
          <div className="min-h-full p-4 md:p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30">
                    <Film className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">🎬 Film Room</h2>
                    <p className="text-slate-400">{publicVideos.length} {publicVideos.length === 1 ? 'video' : 'videos'} available</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilmRoom(false)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all hover:scale-105"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Video Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicVideos.map((video) => (
                <div 
                  key={video.id}
                  className="group osys-glass bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden hover:border-red-500/30 hover:shadow-xl hover:shadow-red-500/10 transition-all cursor-pointer hover:scale-[1.02]"
                  onClick={() => {
                    setPlayingVideoId(video.youtubeId);
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black">
                    <img 
                      src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center justify-center group-hover:from-black/60 transition-colors">
                      <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl shadow-red-500/40">
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                    </div>
                    {/* Category Badge */}
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-bold bg-red-500/90 text-white backdrop-blur-sm border border-red-400/30">
                      {video.category}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-5">
                    <h3 className="font-bold text-white line-clamp-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-slate-400 mt-2 line-clamp-2">{video.description}</p>
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
        <div className="fixed inset-0 bg-black/98 z-[60] flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-300">
          <div className="w-full max-w-6xl relative aspect-video bg-black shadow-2xl rounded-2xl overflow-hidden border border-white/10">
            {/* Close Button */}
            <button 
              onClick={() => setPlayingVideoId(null)} 
              className="absolute top-4 right-4 z-10 bg-black/60 text-white hover:bg-red-600 p-3 rounded-xl transition-all backdrop-blur-sm border border-white/10 hover:scale-105"
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

      {/* Live Stream Viewer Modal */}
      {showLiveStreamViewer && teamId && liveStreams.length > 0 && (
        <LiveStreamViewer
          streams={liveStreams}
          teamId={teamId}
          teamName={team.name}
          onClose={() => setShowLiveStreamViewer(false)}
          isCoach={false}
        />
      )}
    </div>
  );
};

export default PublicTeamProfile;
