/**
 * Draft Day Showcase - World-Class Presentation
 * A stunning presentation of the OSYS Draft Day feature
 * Designed to wow pilot program stakeholders
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  Users,
  Clock,
  Zap,
  Star,
  TrendingUp,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  Maximize,
  MessageCircle,
  Timer,
  Award,
  Target,
  BarChart3,
  Shield,
  Heart,
  Activity,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Crown,
  Medal,
  Flame,
  Eye,
  Share2,
  ThumbsUp,
  Radio,
  Tv,
  Calendar,
  MapPin,
  Hash,
  Ticket,
  Shuffle,
  PartyPopper,
  Dices
} from 'lucide-react';

// ============================================================================
// MOCK DATA FOR DRAFT SIMULATION
// ============================================================================

const mockPlayers = [
  { id: 1, name: 'Marcus Johnson', position: 'QB', rating: 98, speed: 92, arm: 97, iq: 95, photo: '🏈', team: null, pick: null },
  { id: 2, name: 'DeShawn Williams', position: 'RB', rating: 96, speed: 98, arm: 65, iq: 88, photo: '🏃', team: null, pick: null },
  { id: 3, name: 'Tyler Chen', position: 'WR', rating: 95, speed: 96, arm: 70, iq: 90, photo: '⚡', team: null, pick: null },
  { id: 4, name: 'Jordan Martinez', position: 'LB', rating: 94, speed: 88, arm: 72, iq: 92, photo: '🛡️', team: null, pick: null },
  { id: 5, name: 'Chris Thompson', position: 'CB', rating: 93, speed: 95, arm: 68, iq: 89, photo: '🔒', team: null, pick: null },
  { id: 6, name: 'Andre Davis', position: 'WR', rating: 92, speed: 94, arm: 71, iq: 87, photo: '🎯', team: null, pick: null },
  { id: 7, name: 'Brandon Lee', position: 'OL', rating: 91, speed: 72, arm: 60, iq: 94, photo: '🏋️', team: null, pick: null },
  { id: 8, name: 'Kevin Brown', position: 'DL', rating: 90, speed: 85, arm: 65, iq: 86, photo: '💪', team: null, pick: null },
];

const mockTeams = [
  { id: 1, name: 'Thunder Hawks', color: '#f97316', emoji: '🦅', picks: [] },
  { id: 2, name: 'Storm Raiders', color: '#3b82f6', emoji: '⛈️', picks: [] },
  { id: 3, name: 'Fire Dragons', color: '#ef4444', emoji: '🐉', picks: [] },
  { id: 4, name: 'Ice Wolves', color: '#06b6d4', emoji: '🐺', picks: [] },
];

const draftHistory = [
  { pick: 1, team: 'Thunder Hawks', player: 'Marcus Johnson', position: 'QB', time: '2:34' },
  { pick: 2, team: 'Storm Raiders', player: 'DeShawn Williams', position: 'RB', time: '1:58' },
  { pick: 3, team: 'Fire Dragons', player: 'Tyler Chen', position: 'WR', time: '2:15' },
];

// Mock lottery results
const mockLotteryResults = [
  { position: 1, team: 'Ice Wolves', emoji: '🐺', color: '#06b6d4', coach: 'Coach Martinez' },
  { position: 2, team: 'Fire Dragons', emoji: '🐉', color: '#ef4444', coach: 'Coach Williams' },
  { position: 3, team: 'Thunder Hawks', emoji: '🦅', color: '#f97316', coach: 'Coach Johnson' },
  { position: 4, team: 'Storm Raiders', emoji: '⛈️', color: '#3b82f6', coach: 'Coach Chen' },
];

// ============================================================================
// LOTTERY COMPONENTS
// ============================================================================

// Animated Lottery Wheel
const LotteryWheel: React.FC<{ isSpinning: boolean; winner?: typeof mockLotteryResults[0] }> = ({ isSpinning, winner }) => {
  const teams = mockTeams;
  const segmentAngle = 360 / teams.length;
  
  return (
    <div className="relative w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 mx-auto">
      {/* Outer glow ring */}
      <div className={`absolute -inset-4 rounded-full ${isSpinning ? 'animate-pulse' : ''}`}
           style={{ 
             background: 'conic-gradient(from 0deg, #f97316, #ec4899, #8b5cf6, #3b82f6, #06b6d4, #22c55e, #f97316)',
             filter: 'blur(20px)',
             opacity: isSpinning ? 0.8 : 0.4
           }} />
      
      {/* Wheel background */}
      <div className={`relative w-full h-full rounded-full border-4 border-white/20 shadow-2xl overflow-hidden transition-transform duration-[5000ms] ease-out ${isSpinning ? 'animate-spin' : ''}`}
           style={{ 
             transform: winner ? `rotate(${(mockLotteryResults.findIndex(r => r.team === winner.team) * segmentAngle) + 720}deg)` : undefined,
             background: 'conic-gradient(from 0deg, #f97316 0deg 90deg, #3b82f6 90deg 180deg, #ef4444 180deg 270deg, #06b6d4 270deg 360deg)'
           }}>
        {/* Team segments */}
        {teams.map((team, idx) => (
          <div 
            key={team.id}
            className="absolute top-1/2 left-1/2 w-1/2 h-8 flex items-center justify-end pr-4 origin-left"
            style={{ transform: `rotate(${idx * segmentAngle + segmentAngle/2}deg) translateY(-50%)` }}
          >
            <span className="text-2xl drop-shadow-lg">{team.emoji}</span>
          </div>
        ))}
        
        {/* Center hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-4 border-white/30 flex items-center justify-center shadow-xl">
          <Dices size={24} className="text-orange-400 md:hidden" />
          <Dices size={32} className="text-orange-400 hidden md:block" />
        </div>
      </div>
      
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
        <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-orange-500 drop-shadow-lg" />
      </div>
    </div>
  );
};

// Lottery Ticket Component - Winner Display
const LotteryTicketWinner: React.FC<{ result: typeof mockLotteryResults[0]; isRevealing?: boolean }> = ({ result, isRevealing }) => {
  return (
    <div className="relative group perspective-1000">
      {/* Ticket glow effect */}
      <div className={`absolute -inset-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 rounded-2xl sm:rounded-3xl blur-xl transition-opacity ${isRevealing ? 'opacity-100 animate-pulse' : 'opacity-60 group-hover:opacity-100'}`} />
      
      {/* Main ticket */}
      <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl sm:rounded-3xl border-2 border-yellow-500/50 overflow-hidden shadow-2xl transform transition-transform group-hover:scale-[1.02]">
        {/* Golden header */}
        <div className="relative bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 px-4 py-3 sm:px-6 sm:py-4">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjMpIi8+PC9zdmc+')] opacity-50" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Trophy size={20} className="text-yellow-900 sm:hidden" />
                <Trophy size={28} className="text-yellow-900 hidden sm:block" />
              </div>
              <div>
                <p className="text-yellow-900/80 text-[10px] sm:text-xs font-bold tracking-wider">OSYS DRAFT LOTTERY</p>
                <p className="text-yellow-900 text-base sm:text-xl font-black">2026 SEASON</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-yellow-900/80 text-[10px] sm:text-xs">WINNING PICK</p>
              <p className="text-4xl sm:text-6xl font-black text-yellow-900 leading-none">#{result.position}</p>
            </div>
          </div>
        </div>
        
        {/* Perforated edge effect */}
        <div className="flex justify-between px-2 -my-2 relative z-10">
          {[...Array(15)].map((_, i) => (
            <div key={i} className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-black" />
          ))}
        </div>
        
        {/* Winner info section */}
        <div className="px-4 py-6 sm:px-8 sm:py-8 bg-gradient-to-b from-zinc-800/50 to-zinc-900">
          {/* Team display */}
          <div className="flex items-center gap-4 sm:gap-6 mb-6">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full animate-pulse" style={{ backgroundColor: result.color, opacity: 0.3 }} />
              <div className="relative w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-4xl sm:text-6xl shadow-xl"
                   style={{ backgroundColor: result.color + '30', border: `3px solid ${result.color}` }}>
                {result.emoji}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs sm:text-sm font-medium mb-1">LOTTERY WINNER</p>
              <h3 className="text-xl sm:text-3xl font-black text-white mb-1 truncate">{result.team}</h3>
              <p className="text-slate-500 text-sm sm:text-base">{result.coach}</p>
            </div>
          </div>
          
          {/* Confetti celebration text */}
          <div className="relative bg-gradient-to-r from-orange-500/20 via-pink-500/20 to-purple-500/20 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3">
              <PartyPopper size={24} className="text-yellow-400" />
              <div>
                <p className="text-white font-bold">Congratulations!</p>
                <p className="text-slate-400 text-sm">First pick in the 2026 OSYS Draft</p>
              </div>
            </div>
          </div>
          
          {/* Ticket details */}
          <div className="mt-4 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div className="bg-zinc-800/50 rounded-lg sm:rounded-xl p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-slate-500">DRAFT DATE</p>
              <p className="text-white font-bold text-xs sm:text-base">March 15</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg sm:rounded-xl p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-slate-500">LOTTERY #</p>
              <p className="text-orange-400 font-mono font-bold text-xs sm:text-base">L-2026-001</p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg sm:rounded-xl p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-slate-500">LEAGUE</p>
              <p className="text-white font-bold truncate text-xs sm:text-base">Thunder Youth</p>
            </div>
          </div>
        </div>
        
        {/* Bottom barcode section */}
        <div className="bg-zinc-950 px-4 py-3 sm:px-8 sm:py-4 flex items-center justify-between border-t border-white/5">
          <div className="flex gap-0.5 sm:gap-1">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="w-0.5 sm:w-1 bg-white/80" style={{ height: Math.random() * 15 + 15 }} />
            ))}
          </div>
          <p className="text-slate-600 text-[10px] sm:text-xs font-mono">OSYS-2026-LOTTERY</p>
        </div>
      </div>
    </div>
  );
};

// Full Lottery Results Board
const LotteryResultsBoard: React.FC = () => {
  const [revealedPositions, setRevealedPositions] = useState<number[]>([4, 3, 2, 1]);
  
  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 flex items-center justify-center">
            <Shuffle size={18} className="text-white sm:hidden" />
            <Shuffle size={24} className="text-white hidden sm:block" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm sm:text-lg">DRAFT LOTTERY RESULTS</h3>
            <p className="text-white/70 text-xs sm:text-sm">2026 Thunder Youth League</p>
          </div>
        </div>
      </div>
      
      {/* Results list */}
      <div className="p-6 space-y-3">
        {mockLotteryResults.map((result, idx) => (
          <div 
            key={result.position}
            className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ${
              revealedPositions.includes(result.position) 
                ? result.position === 1 
                  ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30' 
                  : 'bg-zinc-800/50 border border-white/5'
                : 'bg-zinc-900/50 opacity-50'
            }`}
          >
            {/* Position badge */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${
              result.position === 1 
                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-yellow-900' 
                : 'bg-zinc-700 text-white'
            }`}>
              #{result.position}
            </div>
            
            {/* Team info */}
            <div className="flex items-center gap-3 flex-1">
              <span className="text-3xl">{result.emoji}</span>
              <div>
                <p className="font-bold text-white">{result.team}</p>
                <p className="text-xs text-slate-500">{result.coach}</p>
              </div>
            </div>
            
            {/* Status */}
            {result.position === 1 && revealedPositions.includes(1) && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 rounded-lg">
                <Crown size={16} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm font-bold">1ST PICK!</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Animated gradient background
const AnimatedBackground: React.FC = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-500/20 rounded-full blur-[100px] animate-pulse" />
    <div className="absolute top-1/4 -right-40 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
    <div className="absolute bottom-0 left-1/3 w-[600px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-orange-500/5 to-pink-500/5 rounded-full blur-[150px]" />
  </div>
);

// Player Draft Card
const PlayerDraftCard: React.FC<{ player: typeof mockPlayers[0]; featured?: boolean; onDraft?: () => void }> = ({ player, featured, onDraft }) => {
  const getPositionColor = (pos: string) => {
    const colors: Record<string, string> = {
      QB: 'from-orange-500 to-red-500',
      RB: 'from-green-500 to-emerald-500',
      WR: 'from-blue-500 to-cyan-500',
      LB: 'from-purple-500 to-violet-500',
      CB: 'from-pink-500 to-rose-500',
      OL: 'from-yellow-500 to-amber-500',
      DL: 'from-red-500 to-orange-500',
    };
    return colors[pos] || 'from-gray-500 to-slate-500';
  };

  if (featured) {
    return (
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 rounded-3xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity animate-pulse" />
        
        <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-white/20 overflow-hidden">
          {/* Card Header with Position */}
          <div className={`bg-gradient-to-r ${getPositionColor(player.position)} p-4`}>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-white/80 text-sm font-medium">DRAFT PROSPECT</span>
                <div className="text-4xl font-black text-white">{player.position}</div>
              </div>
              <div className="text-right">
                <div className="text-6xl font-black text-white/90">{player.rating}</div>
                <span className="text-white/70 text-sm">OVERALL</span>
              </div>
            </div>
          </div>
          
          {/* Player Photo Area */}
          <div className="relative h-48 bg-gradient-to-b from-zinc-800 to-zinc-900 flex items-center justify-center">
            <span className="text-[120px]">{player.photo}</span>
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-900 to-transparent" />
          </div>
          
          {/* Player Name */}
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-2xl font-bold text-white">{player.name}</h3>
            <p className="text-slate-400">Class of 2026 • Youth League MVP</p>
          </div>
          
          {/* Stats */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Speed', value: player.speed, icon: Zap },
                { label: 'Arm', value: player.arm, icon: Target },
                { label: 'Football IQ', value: player.iq, icon: Activity },
              ].map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <stat.icon size={14} className="text-orange-400" />
                    <span className="text-xs text-slate-400">{stat.label}</span>
                  </div>
                  <div className="relative h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getPositionColor(player.position)} rounded-full transition-all duration-1000`}
                      style={{ width: `${stat.value}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold text-white">{stat.value}</span>
                </div>
              ))}
            </div>
            
            {onDraft && (
              <button 
                onClick={onDraft}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 rounded-xl text-white font-bold text-lg transition-all hover:scale-[1.02] shadow-lg shadow-orange-500/30"
              >
                Draft Player
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 backdrop-blur-md rounded-xl border border-white/10 hover:border-orange-500/50 transition-all hover:scale-[1.02] overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${getPositionColor(player.position)}`} />
      <div className="p-4 flex items-center gap-4">
        <div className="text-4xl">{player.photo}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r ${getPositionColor(player.position)} text-white`}>
              {player.position}
            </span>
            <span className="text-lg font-bold text-white">{player.name}</span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-slate-400">SPD: <span className="text-white">{player.speed}</span></span>
            <span className="text-sm text-slate-400">ARM: <span className="text-white">{player.arm}</span></span>
            <span className="text-sm text-slate-400">IQ: <span className="text-white">{player.iq}</span></span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-orange-400">{player.rating}</div>
          <span className="text-xs text-slate-500">OVR</span>
        </div>
      </div>
    </div>
  );
};

// Draft Timer Component
const DraftTimer: React.FC<{ seconds: number; isActive: boolean }> = ({ seconds, isActive }) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = (seconds / 180) * 100; // 3 minute timer
  
  return (
    <div className="relative">
      <div className={`text-6xl font-mono font-black ${isActive ? 'text-orange-400 animate-pulse' : 'text-white'}`}>
        {String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div className="mt-2 h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${
            progress > 50 ? 'bg-green-500' : progress > 25 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-sm text-slate-400 mt-1">Time Remaining</p>
    </div>
  );
};

// Live Stream Mockup
const LiveStreamMockup: React.FC = () => (
  <div className="relative bg-black rounded-2xl overflow-hidden border border-white/10">
    {/* Video Area */}
    <div className="relative aspect-video bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Fake video content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-8xl mb-4">🎬</div>
          <p className="text-2xl font-bold text-white">OSYS Draft Day LIVE</p>
          <p className="text-slate-400">Thunder Hawks Youth Football League</p>
        </div>
      </div>
      
      {/* Live badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white font-bold text-sm">LIVE</span>
        </div>
        <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg">
          <span className="text-white text-sm">👁️ 1,247 watching</span>
        </div>
      </div>
      
      {/* Current pick overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-400 font-bold">NOW PICKING</p>
            <p className="text-2xl font-bold text-white">🦅 Thunder Hawks</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400">Round 1</p>
            <p className="text-3xl font-bold text-white">Pick #4</p>
          </div>
        </div>
      </div>
    </div>
    
    {/* Controls */}
    <div className="p-4 bg-zinc-900 border-t border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <Play size={20} className="text-white" />
        </button>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <Volume2 size={20} className="text-white" />
        </button>
        <div className="flex-1 h-1 bg-zinc-700 rounded-full mx-4 max-w-[200px]">
          <div className="w-3/4 h-full bg-orange-500 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <MessageCircle size={20} className="text-white" />
        </button>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <Share2 size={20} className="text-white" />
        </button>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <Maximize size={20} className="text-white" />
        </button>
      </div>
    </div>
  </div>
);

// Feature Card
const FeatureCard: React.FC<{ icon: React.ElementType; title: string; description: string; gradient: string }> = ({ icon: Icon, title, description, gradient }) => (
  <div className="group relative overflow-hidden bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all hover:scale-[1.02]">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg`}>
      <Icon size={28} className="text-white" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </div>
);

// Stat Ring
const StatRing: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => {
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (value / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Mobile size */}
        <svg width="90" height="90" className="-rotate-90 sm:hidden">
          <circle cx="45" cy="45" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-zinc-700" />
          <circle 
            cx="45" 
            cy="45" 
            r="36" 
            fill="none" 
            stroke={color} 
            strokeWidth="6" 
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        {/* Desktop size */}
        <svg width="120" height="120" className="-rotate-90 hidden sm:block">
          <circle cx="60" cy="60" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-700" />
          <circle 
            cx="60" 
            cy="60" 
            r="45" 
            fill="none" 
            stroke={color} 
            strokeWidth="8" 
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={(2 * Math.PI * 45) - (value / 100) * (2 * Math.PI * 45)}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg sm:text-2xl font-bold text-white">{value}%</span>
        </div>
      </div>
      <span className="text-xs sm:text-sm text-slate-400 mt-2 text-center max-w-[80px] sm:max-w-none">{label}</span>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DraftDayShowcase: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [draftTime, setDraftTime] = useState(127);
  const [animatedStats, setAnimatedStats] = useState({ engagement: 0, fairness: 0, excitement: 0 });
  
  // Animate stats on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedStats({ engagement: 94, fairness: 98, excitement: 96 });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Draft timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setDraftTime(prev => prev > 0 ? prev - 1 : 180);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <AnimatedBackground />
      
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Badge */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full">
                <Sparkles size={16} className="text-orange-400" />
                <span className="text-orange-400 font-medium">New Feature Concept</span>
              </div>
            </div>
            
            {/* Title */}
            <div className="text-center mb-12">
              <h1 className="text-5xl md:text-7xl font-black mb-6">
                <span className="bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                  DRAFT DAY
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Transform youth sports team building into an 
                <span className="text-orange-400 font-semibold"> electrifying NFL-style experience</span> 
                that creates buzz, fairness, and unforgettable memories.
              </p>
            </div>
            
            {/* Stats Rings */}
            <div className="flex justify-center gap-4 sm:gap-8 md:gap-12 mb-12 sm:mb-16 flex-wrap">
              <StatRing value={animatedStats.engagement} label="Parent Engagement" color="#f97316" />
              <StatRing value={animatedStats.fairness} label="Team Fairness" color="#22c55e" />
              <StatRing value={animatedStats.excitement} label="Player Excitement" color="#a855f7" />
            </div>
          </div>
        </section>

        {/* Problem/Solution Section */}
        <section className="py-12 sm:py-20 px-4 bg-gradient-to-b from-transparent via-zinc-900/50 to-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-12">
              {/* Problem */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-red-500/20 rounded-xl">
                    <span className="text-3xl">😤</span>
                  </div>
                  <h2 className="text-2xl font-bold text-red-400">The Problem</h2>
                </div>
                <ul className="space-y-4">
                  {[
                    'Traditional team picks feel random and unfair',
                    'Parents question coach favoritism',
                    'No excitement or event around team formation',
                    'Kids feel overlooked or undervalued',
                    'No transparency in selection process',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-red-400 mt-1">✕</span>
                      <span className="text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Solution */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <span className="text-3xl">🎉</span>
                  </div>
                  <h2 className="text-2xl font-bold text-green-400">The Solution</h2>
                </div>
                <ul className="space-y-4">
                  {[
                    'NFL-style draft creates fair, transparent picks',
                    'Every player gets their spotlight moment',
                    'Live streaming turns it into a community event',
                    'Parents see the process in real-time',
                    'Creates memories and league engagement',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle size={20} className="text-green-400 mt-0.5 shrink-0" />
                      <span className="text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 🎰 DRAFT LOTTERY SECTION - NFL STYLE (Happens BEFORE the draft!) */}
        <section className="py-20 px-4 bg-gradient-to-b from-transparent via-purple-900/10 to-transparent overflow-hidden">
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-8 sm:mb-16">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-500/20 border border-purple-500/30 rounded-full mb-4 sm:mb-6">
                <Shuffle size={14} className="text-purple-400 sm:hidden" />
                <Shuffle size={16} className="text-purple-400 hidden sm:block" />
                <span className="text-purple-400 font-medium text-sm sm:text-base">Step 1: Determine Pick Order</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                🎰 Draft Lottery
              </h2>
              <p className="text-base sm:text-xl text-slate-400 max-w-3xl mx-auto px-4 sm:px-0">
                NFL-style lottery system for ultimate fairness. Enable lottery mode and let fate 
                decide the draft order with a <span className="text-purple-400 font-semibold">live animated reveal</span>.
              </p>
            </div>
            
            {/* Main Lottery Display */}
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center mb-8 sm:mb-16">
              {/* Left - Lottery Wheel */}
              <div className="relative">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-8 flex items-center justify-center gap-3">
                    <Dices size={28} className="text-purple-400" />
                    Live Lottery Wheel
                  </h3>
                  <LotteryWheel isSpinning={false} winner={mockLotteryResults[0]} />
                  <p className="text-slate-400 mt-8 max-w-sm mx-auto">
                    All coaches watch the wheel spin live. Real-time sync ensures everyone sees the same results simultaneously.
                  </p>
                </div>
              </div>
              
              {/* Right - Results Board */}
              <div>
                <LotteryResultsBoard />
              </div>
            </div>
            
            {/* Winner Ticket Showcase */}
            <div className="mb-8 sm:mb-16">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">🎫 Winning Lottery Ticket</h3>
                <p className="text-slate-400">What the #1 pick winner sees after the lottery</p>
              </div>
              <div className="max-w-lg mx-auto">
                <LotteryTicketWinner result={mockLotteryResults[0]} />
              </div>
            </div>
            
            {/* Lottery Benefits Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {[
                {
                  icon: Shield,
                  title: 'Ultimate Fairness',
                  description: 'No coach can be accused of rigging the order. Pure random chance.',
                  gradient: 'from-green-500 to-emerald-500'
                },
                {
                  icon: Sparkles,
                  title: 'NFL-Style Drama',
                  description: 'Create "Remember when we won the lottery?" moments for your league.',
                  gradient: 'from-purple-500 to-pink-500'
                },
                {
                  icon: Users,
                  title: 'Watch Together',
                  description: 'Parents & players gather for the live lottery reveal event.',
                  gradient: 'from-blue-500 to-cyan-500'
                },
                {
                  icon: Trophy,
                  title: 'Saved History',
                  description: 'All lottery results stored forever. Relive the excitement each season.',
                  gradient: 'from-orange-500 to-amber-500'
                }
              ].map((benefit, idx) => (
                <div key={idx} className="group relative overflow-hidden bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-md rounded-2xl border border-white/10 p-6 hover:border-purple-500/30 transition-all hover:scale-[1.02]">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${benefit.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                    <benefit.icon size={24} className="text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{benefit.title}</h4>
                  <p className="text-slate-400 text-sm">{benefit.description}</p>
                </div>
              ))}
            </div>
            
            {/* How It Works */}
            <div className="mt-8 sm:mt-16 bg-gradient-to-br from-zinc-800/30 to-zinc-900/30 rounded-2xl sm:rounded-3xl border border-white/10 p-4 sm:p-8">
              <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-6 sm:mb-8">How Lottery Mode Works</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
                {[
                  { step: 1, title: 'Enable Lottery', desc: 'Commissioner toggles lottery mode when creating the draft', icon: '⚙️' },
                  { step: 2, title: 'Coaches Join', desc: 'All team coaches join the draft lobby before lottery starts', icon: '👥' },
                  { step: 3, title: 'Live Draw', desc: 'Animated wheel/ball draw reveals pick order in real-time', icon: '🎰' },
                  { step: 4, title: 'Draft Begins', desc: 'With order set, the draft starts immediately', icon: '🏈' },
                ].map((item) => (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-2 sm:mb-4">
                      <span className="text-xl sm:text-3xl">{item.icon}</span>
                    </div>
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-purple-500 text-white font-bold text-xs sm:text-base flex items-center justify-center mx-auto mb-1 sm:mb-2">
                      {item.step}
                    </div>
                    <h4 className="font-bold text-white mb-1 text-sm sm:text-base">{item.title}</h4>
                    <p className="text-xs sm:text-sm text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Live Draft Mockup */}
        <section id="mockup" className="py-12 sm:py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-orange-500/20 border border-orange-500/30 rounded-full mb-4 sm:mb-6">
                <Radio size={14} className="text-orange-400 sm:hidden" />
                <Radio size={16} className="text-orange-400 hidden sm:block" />
                <span className="text-orange-400 font-medium text-sm sm:text-base">Step 2: Make Your Picks</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                Live Draft Experience
              </h2>
              <p className="text-base sm:text-xl text-slate-400">See how Draft Day will look in action</p>
            </div>
            
            {/* Draft Dashboard Mockup */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Header Bar */}
              <div className="bg-gradient-to-r from-orange-600 to-pink-600 px-3 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <Trophy size={20} className="text-white sm:hidden" />
                    <Trophy size={28} className="text-white hidden sm:block" />
                    <div>
                      <h3 className="font-bold text-white text-sm sm:text-lg">OSYS Draft Day 2026</h3>
                      <p className="text-white/80 text-xs sm:text-sm hidden sm:block">Thunder Hawks Youth Football League</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 bg-white/20 rounded-lg">
                      <Radio size={12} className="text-white animate-pulse sm:hidden" />
                      <Radio size={16} className="text-white animate-pulse hidden sm:block" />
                      <span className="text-white font-medium text-xs sm:text-base">LIVE</span>
                    </div>
                    <DraftTimer seconds={draftTime} isActive={true} />
                  </div>
                </div>
              </div>
              
              {/* Main Content */}
              <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 p-3 sm:p-6">
                {/* Left Column - Live Stream */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <LiveStreamMockup />
                  
                  {/* Current On The Clock */}
                  <div className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl sm:text-3xl">🦅</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-orange-400 font-bold text-xs sm:text-sm">ON THE CLOCK</p>
                          <h3 className="text-lg sm:text-2xl font-bold text-white truncate">Thunder Hawks</h3>
                          <p className="text-slate-400 text-xs sm:text-base">Round 1, Pick #4</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-slate-400 text-xs sm:text-sm">Team Needs</p>
                        <div className="flex gap-1 sm:gap-2 mt-1">
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-500/20 text-red-400 text-[10px] sm:text-xs rounded font-medium">OL</span>
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-500/20 text-yellow-400 text-[10px] sm:text-xs rounded font-medium">DL</span>
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-500/20 text-blue-400 text-[10px] sm:text-xs rounded font-medium">CB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Available Players */}
                  <div className="bg-zinc-800/50 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                      <Users size={18} className="text-orange-400 sm:hidden" />
                      <Users size={20} className="text-orange-400 hidden sm:block" />
                      Available Players
                    </h3>
                    <div className="space-y-3">
                      {mockPlayers.slice(3).map(player => (
                        <PlayerDraftCard key={player.id} player={player} />
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Right Column - Draft History & Teams */}
                <div className="space-y-4 sm:space-y-6">
                  {/* Featured Player Card */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                      <Star size={18} className="text-yellow-400 sm:hidden" />
                      <Star size={20} className="text-yellow-400 hidden sm:block" />
                      Top Available
                    </h3>
                    <PlayerDraftCard player={mockPlayers[3]} featured onDraft={() => {}} />
                  </div>
                  
                  {/* Draft History */}
                  <div className="bg-zinc-800/50 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                      <Clock size={18} className="text-blue-400 sm:hidden" />
                      <Clock size={20} className="text-blue-400 hidden sm:block" />
                      Draft History
                    </h3>
                    <div className="space-y-2 sm:space-y-3">
                      {draftHistory.map((pick, idx) => (
                        <div key={idx} className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-zinc-900/50 rounded-lg sm:rounded-xl border border-white/5">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-white text-sm sm:text-base flex-shrink-0">
                            #{pick.pick}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm sm:text-base truncate">{pick.player}</p>
                            <p className="text-[10px] sm:text-xs text-slate-400">{pick.team} • {pick.position}</p>
                          </div>
                          <span className="text-[10px] sm:text-xs text-slate-500 flex-shrink-0">{pick.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Teams */}
                  <div className="bg-zinc-800/50 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                      <Shield size={18} className="text-purple-400 sm:hidden" />
                      <Shield size={20} className="text-purple-400 hidden sm:block" />
                      Teams
                    </h3>
                    <div className="space-y-2">
                      {mockTeams.map((team, idx) => (
                        <div 
                          key={team.id} 
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all ${idx === 0 ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-zinc-900/50'}`}
                        >
                          <span className="text-2xl">{team.emoji}</span>
                          <div className="flex-1">
                            <p className="font-medium text-white">{team.name}</p>
                            <p className="text-xs text-slate-400">{idx + 1} picks made</p>
                          </div>
                          {idx === 0 && (
                            <span className="px-2 py-1 bg-orange-500/30 text-orange-400 text-xs rounded font-bold animate-pulse">
                              PICKING
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-12 sm:py-20 px-4 bg-gradient-to-b from-transparent via-zinc-900/50 to-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                Everything You Need for Draft Day
              </h2>
              <p className="text-base sm:text-xl text-slate-400">Powerful features that make every pick memorable</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <FeatureCard 
                icon={Tv}
                title="Live Streaming"
                description="Broadcast your draft live to parents and fans. Built-in chat, reactions, and multi-camera support."
                gradient="from-red-500 to-pink-500"
              />
              <FeatureCard 
                icon={Timer}
                title="Pick Timer"
                description="Configurable countdown timer keeps the draft moving. Auto-pick option for timeouts."
                gradient="from-orange-500 to-amber-500"
              />
              <FeatureCard 
                icon={Award}
                title="Player Cards"
                description="Beautiful player profile cards with stats, highlights, and ratings that coaches can review."
                gradient="from-yellow-500 to-orange-500"
              />
              <FeatureCard 
                icon={BarChart3}
                title="Team Balance Analysis"
                description="AI-powered suggestions help coaches build balanced teams based on positions and skills."
                gradient="from-green-500 to-emerald-500"
              />
              <FeatureCard 
                icon={MessageCircle}
                title="Live Chat"
                description="Real-time chat for coaches, parents, and fans. Celebrate picks together as a community."
                gradient="from-blue-500 to-cyan-500"
              />
              <FeatureCard 
                icon={Trophy}
                title="Draft History"
                description="Complete archive of all picks. Relive the excitement and track roster evolution over seasons."
                gradient="from-purple-500 to-violet-500"
              />
            </div>
          </div>
        </section>

        {/* Draft Order Types */}
        <section className="py-12 sm:py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                Flexible Draft Formats
              </h2>
              <p className="text-base sm:text-xl text-slate-400">Choose the format that works best for your league</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
              {/* Snake Draft */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl sm:rounded-3xl blur opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-zinc-900 rounded-2xl sm:rounded-3xl border border-white/10 p-5 sm:p-8 h-full">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                    <span className="text-2xl sm:text-3xl">🐍</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Snake Draft</h3>
                  <p className="text-slate-400 text-sm sm:text-base mb-4 sm:mb-6">Order reverses each round for maximum fairness. Team picking last in round 1 picks first in round 2.</p>
                  <div className="bg-zinc-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-slate-500 mb-2">Example Order:</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-300">R1: A → B → C → D</p>
                      <p className="text-orange-400">R2: D → C → B → A</p>
                      <p className="text-slate-300">R3: A → B → C → D</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Linear Draft */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl sm:rounded-3xl blur opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-zinc-900 rounded-2xl sm:rounded-3xl border border-white/10 p-5 sm:p-8 h-full">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                    <span className="text-2xl sm:text-3xl">📏</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Linear Draft</h3>
                  <p className="text-slate-400 text-sm sm:text-base mb-4 sm:mb-6">Same order every round. Simple and straightforward for smaller leagues or quick drafts.</p>
                  <div className="bg-zinc-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-slate-500 mb-2">Example Order:</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-300">R1: A → B → C → D</p>
                      <p className="text-blue-400">R2: A → B → C → D</p>
                      <p className="text-slate-300">R3: A → B → C → D</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Auction Draft */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl sm:rounded-3xl blur opacity-25 group-hover:opacity-50 transition-opacity" />
                <div className="relative bg-zinc-900 rounded-2xl sm:rounded-3xl border border-white/10 p-5 sm:p-8 h-full">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                    <span className="text-2xl sm:text-3xl">💰</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Auction Draft</h3>
                  <p className="text-slate-400 text-sm sm:text-base mb-4 sm:mb-6">Teams bid virtual currency on players. Most strategic format with budget management.</p>
                  <div className="bg-zinc-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <p className="text-xs text-slate-500 mb-2">Example:</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-300">Budget: $100 per team</p>
                      <p className="text-green-400">Bid: Team A bids $25</p>
                      <p className="text-slate-300">Going once... Sold!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Implementation Timeline */}
        <section className="py-12 sm:py-20 px-4 bg-gradient-to-b from-transparent via-zinc-900/50 to-transparent">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                Implementation Roadmap
              </h2>
              <p className="text-base sm:text-xl text-slate-400">How we'll bring Draft Day to life</p>
            </div>
            
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-4 sm:left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-500 via-pink-500 to-purple-500" />
              
              {/* Timeline Items */}
              <div className="space-y-6 sm:space-y-12">
                {[
                  {
                    phase: 'Phase 1',
                    title: 'Core Draft Engine',
                    description: 'Build the real-time draft room with Firebase sync, pick timer, and player pool management.',
                    items: ['DraftLobby.tsx', 'Real-time sync', 'Pick validation', 'Draft order management'],
                    color: 'orange',
                    weeks: '2-3 weeks'
                  },
                  {
                    phase: 'Phase 2',
                    title: 'Live Experience',
                    description: 'Add live streaming, chat, and the visual experience that makes Draft Day special.',
                    items: ['YouTube Live integration', 'Live chat', 'Pick animations', 'Sound effects'],
                    color: 'pink',
                    weeks: '2 weeks'
                  },
                  {
                    phase: 'Phase 3',
                    title: 'AI Intelligence',
                    description: 'Smart draft assistance with AI-powered suggestions and team balance analysis.',
                    items: ['AI recommendations', 'Need analysis', 'Trade proposals', 'Draft grades'],
                    color: 'purple',
                    weeks: '2 weeks'
                  },
                ].map((phase, idx) => (
                  <div key={idx} className="relative pl-10 sm:pl-20">
                    {/* Dot */}
                    <div className={`absolute left-2 sm:left-6 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-${phase.color}-500 border-4 border-zinc-900 -translate-x-1/2`} 
                         style={{ backgroundColor: phase.color === 'orange' ? '#f97316' : phase.color === 'pink' ? '#ec4899' : '#a855f7' }} />
                    
                    <div className="bg-zinc-800/50 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                        <div>
                          <span className={`text-${phase.color}-400 font-bold text-xs sm:text-sm`} 
                                style={{ color: phase.color === 'orange' ? '#fb923c' : phase.color === 'pink' ? '#f472b6' : '#c084fc' }}>
                            {phase.phase}
                          </span>
                          <h3 className="text-lg sm:text-xl font-bold text-white">{phase.title}</h3>
                        </div>
                        <span className="px-2 sm:px-3 py-1 bg-white/10 rounded-full text-xs sm:text-sm text-slate-400 w-fit">{phase.weeks}</span>
                      </div>
                      <p className="text-slate-400 text-sm sm:text-base mb-3 sm:mb-4">{phase.description}</p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {phase.items.map((item, i) => (
                          <span key={i} className="px-2 sm:px-3 py-0.5 sm:py-1 bg-zinc-700/50 rounded-lg text-xs sm:text-sm text-slate-300">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Database Schema */}
        <section className="py-12 sm:py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                Technical Architecture
              </h2>
              <p className="text-base sm:text-xl text-slate-400">Built on our proven Firebase infrastructure</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              {/* Database Collections */}
              <div className="bg-zinc-800/50 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">🗄️</span>
                  Firestore Collections
                </h3>
                <div className="space-y-2 sm:space-y-3 font-mono text-xs sm:text-sm">
                  {[
                    { name: 'drafts', desc: 'Draft events with settings & status' },
                    { name: 'drafts/{id}/picks', desc: 'Individual pick records' },
                    { name: 'drafts/{id}/players', desc: 'Available player pool' },
                    { name: 'drafts/{id}/teams', desc: 'Team rosters & order' },
                    { name: 'drafts/{id}/lottery', desc: '🆕 Lottery results & history' },
                    { name: 'draftSettings', desc: 'League draft configurations' },
                    { name: 'draftHistory', desc: 'Historical draft records' },
                  ].map((col, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                      <span className="text-green-400">📁</span>
                      <div>
                        <p className="text-orange-400">{col.name}</p>
                        <p className="text-slate-500 text-xs">{col.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Components */}
              <div className="bg-zinc-800/50 rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">⚛️</span>
                  React Components
                </h3>
                <div className="space-y-2 sm:space-y-3 font-mono text-xs sm:text-sm">
                  {[
                    { name: 'DraftLobby.tsx', desc: 'Main draft room interface' },
                    { name: 'DraftBoard.tsx', desc: 'Visual player board' },
                    { name: 'DraftTimer.tsx', desc: 'Pick countdown timer' },
                    { name: 'DraftLottery.tsx', desc: '🆕 Live lottery wheel animation' },
                    { name: 'LotteryTicket.tsx', desc: '🆕 Winner ticket display' },
                    { name: 'PlayerCard.tsx', desc: 'Player profile cards' },
                    { name: 'DraftHistory.tsx', desc: 'Pick history display' },
                    { name: 'DraftSettings.tsx', desc: 'Commissioner config' },
                  ].map((comp, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                      <span className="text-blue-400">📄</span>
                      <div>
                        <p className="text-cyan-400">{comp.name}</p>
                        <p className="text-slate-500 text-xs">{comp.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section className="py-12 sm:py-20 px-4 bg-gradient-to-b from-transparent via-orange-500/5 to-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
                The OSYS Difference
              </h2>
              <p className="text-base sm:text-xl text-slate-400">Why Draft Day will transform your league</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              {[
                { icon: Heart, value: '3x', label: 'Parent Engagement', desc: 'Watch parties & live chat' },
                { icon: Shield, value: '100%', label: 'Transparency', desc: 'Every pick is public' },
                { icon: Star, value: '5 min', label: 'Setup Time', desc: 'Commissioner dashboard' },
                { icon: TrendingUp, value: '∞', label: 'Memories', desc: 'Relive draft highlights' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6 text-center hover:border-orange-500/30 transition-all hover:scale-[1.02]">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-500/20 to-pink-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4">
                    <stat.icon size={20} className="text-orange-400 sm:hidden" />
                    <stat.icon size={28} className="text-orange-400 hidden sm:block" />
                  </div>
                  <div className="text-2xl sm:text-4xl font-black text-white mb-0.5 sm:mb-1">{stat.value}</div>
                  <div className="text-sm sm:text-lg font-semibold text-orange-400">{stat.label}</div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 sm:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-600/20 via-pink-600/20 to-purple-600/20 rounded-2xl sm:rounded-3xl border border-white/10 p-6 sm:p-12 text-center">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-20 -left-20 w-40 sm:w-64 h-40 sm:h-64 bg-orange-500/30 rounded-full blur-3xl" />
                <div className="absolute -bottom-20 -right-20 w-40 sm:w-64 h-40 sm:h-64 bg-purple-500/30 rounded-full blur-3xl" />
              </div>
              
              <div className="relative z-10">
                <div className="text-4xl sm:text-6xl mb-4 sm:mb-6">🏆</div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">
                  Ready to Transform Your League?
                </h2>
                <p className="text-base sm:text-xl text-slate-300 mb-6 sm:mb-8 max-w-2xl mx-auto">
                  Draft Day is coming to OSYS. Be among the first leagues to experience 
                  the future of youth sports team building.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
                  <a 
                    href="/progress"
                    className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 rounded-xl text-white font-bold text-base sm:text-lg transition-all hover:scale-105 shadow-xl shadow-orange-500/30"
                  >
                    View Development Progress
                    <ArrowRight size={18} className="sm:hidden" />
                    <ArrowRight size={20} className="hidden sm:block" />
                  </a>
                  <a 
                    href="/"
                    className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-white font-bold text-base sm:text-lg transition-all"
                  >
                    Back to OSYS Home
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-white/10">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-slate-500">
              OSYS Draft Day Concept • Designed for the {new Date().getFullYear()} Pilot Program
            </p>
            <p className="text-slate-600 text-sm mt-2">
              This presentation showcases planned features. Implementation timeline subject to pilot feedback.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DraftDayShowcase;
