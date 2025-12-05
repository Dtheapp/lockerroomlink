import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Player, Team, PlayerSeasonStats, Game, TeamEvent, UserProfile, Video } from '../../types';
import { Users, Trophy, Calendar, MapPin, Clock, User, Crown, Star, Shield, Sword, TrendingUp, ChevronRight, Home, X, Heart, Award, Film, Play } from 'lucide-react';

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

  useEffect(() => {
    const fetchTeamData = async () => {
      if (!teamId) {
        setError('No team ID provided');
        setLoading(false);
        return;
      }

      try {
        // Get team document
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) {
          setError('Team not found');
          setLoading(false);
          return;
        }

        const team = { id: teamDoc.id, ...teamDoc.data() } as Team;
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
          const belongsToTeam = coachData.teamId === teamId || 
            (coachData.teamIds && coachData.teamIds.includes(teamId));
          
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
        const playersSnapshot = await getDocs(collection(db, 'teams', teamId, 'players'));
        const players = playersSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Player))
          .sort((a, b) => (a.number || 999) - (b.number || 999));

        // Get games for current season
        const gamesQuery = query(
          collection(db, 'teams', teamId, 'games'),
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
        const eventsQuery = query(collection(db, 'teams', teamId, 'events'));
        const eventsSnapshot = await getDocs(eventsQuery);
        const upcomingEvents = eventsSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as TeamEvent))
          .filter(e => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);

        // Get aggregated season stats and find sportsmanship leader
        const seasonStatsSnapshot = await getDocs(collection(db, 'teams', teamId, 'seasonStats'));
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
          const videosSnapshot = await getDocs(collection(db, 'teams', teamId, 'videos'));
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-orange-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-800/50 rounded-2xl p-8 text-center max-w-md border border-zinc-700">
          <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Team Not Found</h1>
          <p className="text-zinc-400 mb-6">
            The team profile you're looking for doesn't exist or has been removed.
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

  const { team, coaches, players, games, upcomingEvents, publicVideos, seasonRecord, seasonStats, sportsmanshipLeader } = data;
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Header Bar */}
      <header className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-black tracking-tighter">
            <span className="text-orange-500">LOCKER</span>
            <span className="text-white">ROOM</span>
          </Link>
          <span className="text-xs text-zinc-500">Team Profile</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-orange-600/20 to-zinc-900/80 rounded-2xl p-4 md:p-8 border border-orange-500/30 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div className="text-center md:text-left w-full md:w-auto">
              <h1 className="text-2xl md:text-5xl font-black text-white mb-1 md:mb-2">{team.name}</h1>
              <p className="text-zinc-400 text-sm md:text-lg mb-3 md:mb-4">{currentYear} Season</p>
              
              {/* Season Record */}
              <div className="flex justify-center md:justify-start gap-2 md:gap-4">
                <div className="bg-emerald-500/20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-emerald-500/30">
                  <span className="text-xl md:text-2xl font-black text-emerald-400">{seasonRecord.wins}</span>
                  <span className="text-zinc-400 text-xs md:text-base ml-1">Wins</span>
                </div>
                <div className="bg-red-500/20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-red-500/30">
                  <span className="text-xl md:text-2xl font-black text-red-400">{seasonRecord.losses}</span>
                  <span className="text-zinc-400 text-xs md:text-base ml-1">Losses</span>
                </div>
                {seasonRecord.ties > 0 && (
                  <div className="bg-yellow-500/20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-yellow-500/30">
                    <span className="text-xl md:text-2xl font-black text-yellow-400">{seasonRecord.ties}</span>
                    <span className="text-zinc-400 text-xs md:text-base ml-1">Ties</span>
                  </div>
                )}
              </div>
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-4 md:grid-cols-2 gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
              <div className="bg-black/40 rounded-lg p-2 md:p-4 text-center border border-zinc-700">
                <p className="text-xl md:text-3xl font-black text-orange-400">{seasonStats.totalTds}</p>
                <p className="text-[10px] md:text-xs text-zinc-500">Team TDs</p>
              </div>
              <div className="bg-black/40 rounded-lg p-2 md:p-4 text-center border border-zinc-700">
                <p className="text-xl md:text-3xl font-black text-cyan-400">{seasonStats.totalRushYards + seasonStats.totalPassYards}</p>
                <p className="text-[10px] md:text-xs text-zinc-500">Total Yards</p>
              </div>
              <div className="bg-black/40 rounded-lg p-2 md:p-4 text-center border border-zinc-700">
                <p className="text-xl md:text-3xl font-black text-emerald-400">{seasonStats.totalTackles}</p>
                <p className="text-[10px] md:text-xs text-zinc-500">Total Tackles</p>
              </div>
              <div className="bg-black/40 rounded-lg p-2 md:p-4 text-center border border-zinc-700">
                <p className="text-xl md:text-3xl font-black text-purple-400">{players.length}</p>
                <p className="text-[10px] md:text-xs text-zinc-500">Players</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Film Room Button - at the top, only shows if videos exist */}
            {publicVideos.length > 0 && (
              <button
                onClick={() => setShowFilmRoom(true)}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl border border-red-500/30 p-6 flex items-center justify-between group transition-all hover:shadow-lg hover:shadow-orange-500/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-black/30 rounded-xl flex items-center justify-center">
                    <Film className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-white">Film Room</h2>
                    <p className="text-white/80 text-sm">{publicVideos.length} {publicVideos.length === 1 ? 'video' : 'videos'} available</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">View All</span>
                  <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            )}

            {/* Coaching Staff */}
            {coaches.length > 0 && (
              <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
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
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all hover:scale-[1.02] ${
                        coach.isHeadCoach 
                          ? 'bg-amber-500/10 border border-amber-500/30 hover:border-amber-400' 
                          : 'bg-zinc-900/50 border border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {coach.photoUrl ? (
                        <img 
                          src={coach.photoUrl} 
                          alt={coach.name}
                          className={`w-10 h-10 rounded-full object-cover border-2 ${
                            coach.isHeadCoach ? 'border-amber-500' : 'border-zinc-600'
                          }`}
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          coach.isHeadCoach ? 'bg-amber-500' : 'bg-zinc-700'
                        }`}>
                          <User className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{coach.name}</p>
                        <p className="text-xs text-zinc-500">
                          {coach.isHeadCoach ? 'Head Coach' : 'Coach'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Team Roster - moved above Game Results */}
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                Team Roster
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {players.map((player) => (
                  <a
                    key={player.id}
                    href={player.username ? `#/athlete/${player.username}` : '#'}
                    target={player.username ? "_blank" : undefined}
                    rel={player.username ? "noopener noreferrer" : undefined}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      player.username 
                        ? 'bg-zinc-900/50 hover:bg-zinc-700/50 border border-zinc-700 cursor-pointer' 
                        : 'bg-zinc-900/30 border border-zinc-800 cursor-default'
                    } ${player.isStarter ? 'ring-2 ring-orange-500/50' : ''}`}
                    onClick={!player.username ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                  >
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                        <User className="w-5 h-5 text-zinc-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate flex items-center gap-1">
                        {player.name}
                        {player.isCaptain && <Crown className="w-3 h-3 text-amber-500" />}
                        {player.isStarter && <Star className="w-3 h-3 text-orange-500" />}
                      </p>
                      <p className="text-xs text-zinc-500">
                        #{player.number || '?'} • {player.position || 'N/A'}
                      </p>
                    </div>
                    {player.username && (
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    )}
                  </a>
                ))}
              </div>
            </div>

            {/* Game Results - moved below Team Roster */}
            {games.length > 0 && (
              <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  {currentYear} Game Results
                </h2>
                <div className="space-y-2">
                  {games.map((game) => {
                    const resultColor = game.result === 'W' ? 'text-emerald-400' : game.result === 'L' ? 'text-red-400' : 'text-yellow-400';
                    const resultBg = game.result === 'W' ? 'bg-emerald-500' : game.result === 'L' ? 'bg-red-500' : 'bg-yellow-500';
                    
                    return (
                      <div key={game.id} className="flex items-center justify-between bg-zinc-900/50 rounded-lg p-3 border border-zinc-700">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 ${resultBg} rounded flex items-center justify-center text-white font-black text-sm`}>
                            {game.result}
                          </div>
                          <div>
                            <p className="font-bold text-white">
                              {game.isHome ? 'vs' : '@'} {game.opponent}
                            </p>
                            <p className="text-xs text-zinc-500">{formatDate(game.date)}</p>
                          </div>
                        </div>
                        <p className={`text-xl font-black ${resultColor}`}>
                          {game.teamScore} - {game.opponentScore}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                className="block sportsmanship-card bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-xl border-2 border-amber-500/50 p-6 relative overflow-hidden transition-all duration-300 cursor-pointer hover:border-amber-400"
              >
                {/* Shimmer overlay handled by CSS ::before */}
                
                {/* Sparkle decorations with animations */}
                <div className="absolute top-2 right-2 text-amber-400 sparkle-animation">
                  <Star className="w-6 h-6" fill="currentColor" />
                </div>
                <div className="absolute bottom-2 left-2 text-amber-400/60 sparkle-animation-delay">
                  <Star className="w-4 h-4" fill="currentColor" />
                </div>
                <div className="absolute top-1/2 right-4 text-amber-400/40 sparkle-animation">
                  <Star className="w-3 h-3" fill="currentColor" />
                </div>
                
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 float-animation">
                  <Award className="w-5 h-5 text-amber-400" />
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                    Sportsmanship Star
                  </span>
                </h2>
                
                <div className="flex items-center gap-4">
                  {/* Player Photo/Avatar */}
                  <div className="relative">
                    {sportsmanshipLeader.player.photoUrl ? (
                      <img 
                        src={sportsmanshipLeader.player.photoUrl} 
                        alt={sportsmanshipLeader.player.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow-lg shadow-amber-500/30"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center border-2 border-amber-400 shadow-lg shadow-amber-500/30">
                        <span className="text-white font-bold text-xl">
                          {sportsmanshipLeader.player.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-zinc-900 shadow-lg shadow-amber-500/50">
                      <Heart className="w-3 h-3 text-zinc-900" fill="currentColor" />
                    </div>
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-lg truncate">{sportsmanshipLeader.player.name}</p>
                    <p className="text-amber-400/80 text-sm">
                      #{sportsmanshipLeader.player.number || '--'} • {sportsmanshipLeader.player.position || 'Player'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                      <span className="text-amber-300 font-bold text-lg">{sportsmanshipLeader.sportsmanshipPoints}</span>
                      <span className="text-amber-400/60 text-xs">sportsmanship points</span>
                    </div>
                  </div>
                  
                  {/* Arrow indicator */}
                  <ChevronRight className="w-5 h-5 text-amber-400/60 flex-shrink-0" />
                </div>
                
                <p className="mt-4 text-xs text-amber-400/70 italic text-center">
                  ✨ Leading by example on and off the field ✨
                </p>
                
                <p className="mt-2 text-xs text-amber-500/50 text-center font-medium">
                  Tap to view full profile →
                </p>
              </a>
            )}

            {/* Top Performers */}
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Top Performers
              </h2>
              <div className="space-y-3">
                {players
                  .filter(p => (p.stats?.td || 0) + (p.stats?.tkl || 0) > 0)
                  .sort((a, b) => ((b.stats?.td || 0) + (b.stats?.tkl || 0)) - ((a.stats?.td || 0) + (a.stats?.tkl || 0)))
                  .slice(0, 5)
                  .map((player, index) => (
                    <div key={player.id} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-amber-500 text-white' : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{player.name}</p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="text-orange-400 font-bold">{player.stats?.td || 0} TD</span>
                        <span className="text-emerald-400 font-bold">{player.stats?.tkl || 0} TKL</span>
                      </div>
                    </div>
                  ))}
                {players.filter(p => (p.stats?.td || 0) + (p.stats?.tkl || 0) > 0).length === 0 && (
                  <p className="text-zinc-500 text-sm">No stats recorded yet.</p>
                )}
              </div>
            </div>

            {/* Upcoming Events - moved below Top Performers */}
            <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                Upcoming Events
              </h2>
              {upcomingEvents.length === 0 ? (
                <p className="text-zinc-500 text-sm">No upcoming events scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => {
                    const typeColor = event.type === 'Game' ? 'bg-orange-500' : event.type === 'Practice' ? 'bg-emerald-500' : 'bg-blue-500';
                    
                    return (
                      <div 
                        key={event.id} 
                        className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-700 cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/50 transition-all"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 ${typeColor} rounded-full mt-1.5 flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm truncate">{event.title}</p>
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(event.date)}
                              {event.time && (
                                <>
                                  <span className="mx-1">•</span>
                                  <Clock className="w-3 h-3" />
                                  {formatTime(event.time)}
                                </>
                              )}
                            </p>
                            {event.location && (
                              <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-zinc-600 text-sm">
          <p>Powered by <span className="text-orange-500 font-bold">LockerRoom</span></p>
        </footer>
      </main>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-6 border-b border-zinc-700">
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                selectedEvent.type === 'Game' ? 'bg-orange-500' : 
                selectedEvent.type === 'Practice' ? 'bg-emerald-500' : 'bg-blue-500'
              }`} />
              <button
                onClick={() => setSelectedEvent(null)}
                className="absolute top-4 right-4 p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                selectedEvent.type === 'Game' ? 'bg-orange-500/20 text-orange-400' : 
                selectedEvent.type === 'Practice' ? 'bg-emerald-500/20 text-emerald-400' : 
                'bg-blue-500/20 text-blue-400'
              }`}>
                {selectedEvent.type}
              </span>
              <h3 className="text-xl font-bold text-white pr-8">{selectedEvent.title}</h3>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Date & Time */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-white font-medium">
                    {formatDate(selectedEvent.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  {selectedEvent.time && (
                    <p className="text-zinc-400 text-sm flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(selectedEvent.time)}
                    </p>
                  )}
                </div>
              </div>

              {/* Location */}
              {selectedEvent.location && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{selectedEvent.location}</p>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div className="pt-4 border-t border-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Details</h4>
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
                    <h2 className="text-2xl font-bold text-white">Film Room</h2>
                    <p className="text-zinc-400">{publicVideos.length} {publicVideos.length === 1 ? 'video' : 'videos'}</p>
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
              {publicVideos.map((video) => (
                <div 
                  key={video.id}
                  className="group bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer"
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
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      <div className="w-14 h-14 bg-orange-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="w-7 h-7 text-white ml-1" />
                      </div>
                    </div>
                    {/* Category Badge */}
                    <div className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-bold bg-red-500/90 text-white">
                      {video.category}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-white line-clamp-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{video.description}</p>
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
    </div>
  );
};

export default PublicTeamProfile;
