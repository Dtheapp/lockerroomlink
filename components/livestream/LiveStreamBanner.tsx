import React from 'react';
import { Radio, Play, Video, Users } from 'lucide-react';
import type { LiveStream } from '../../types';

interface LiveStreamBannerProps {
  streams: LiveStream[];
  teamName: string;
  onClick: () => void;
  compact?: boolean;
}

const LiveStreamBanner: React.FC<LiveStreamBannerProps> = ({ 
  streams, 
  teamName, 
  onClick,
  compact = false
}) => {
  if (streams.length === 0) return null;

  // Get unique camera angles
  const angles = [...new Set(streams.map(s => s.cameraAngle))];
  const angleText = angles.length > 2 
    ? `${angles.slice(0, 2).join(', ')} +${angles.length - 2} more`
    : angles.join(', ');

  if (compact) {
    // Compact version for sidebars or smaller spaces
    return (
      <button
        onClick={onClick}
        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white p-3 rounded-lg flex items-center gap-3 transition-all shadow-lg shadow-red-900/30"
      >
        <div className="bg-white/20 p-2 rounded-lg">
          <Radio className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-sm">🔴 LIVE NOW</div>
          <div className="text-xs text-red-100 truncate">
            {streams.length} stream{streams.length !== 1 ? 's' : ''} • {angleText}
          </div>
        </div>
        <Play className="w-5 h-5" />
      </button>
    );
  }

  // Full banner version for dashboard
  return (
    <div 
      onClick={onClick}
      className="relative overflow-hidden bg-gradient-to-r from-red-600 via-red-700 to-red-800 rounded-xl p-4 cursor-pointer hover:from-red-500 hover:via-red-600 hover:to-red-700 transition-all shadow-xl shadow-red-900/40 group"
    >
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
      
      {/* Pulsing glow effect */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-400/30 rounded-full blur-3xl animate-pulse" />
      
      <div className="relative flex items-center gap-4">
        {/* Live icon */}
        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
          <Radio className="w-8 h-8 text-white animate-pulse" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="bg-white text-red-600 text-xs font-black px-2 py-0.5 rounded animate-pulse">
              🔴 LIVE
            </span>
            <span className="text-white/80 text-sm">{teamName}</span>
            {streams.length > 1 && (
              <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Users className="w-3 h-3" />
                {streams.length} Angles
              </span>
            )}
          </div>
          <h3 className="text-white font-bold text-lg truncate">
            {streams.length === 1 
              ? streams[0].title 
              : `${streams.length} Live Streams - Multi-Angle Coverage`}
          </h3>
          <div className="flex items-center gap-4 mt-1 text-red-100/80 text-sm">
            <span className="flex items-center gap-1">
              <Video className="w-4 h-4" />
              {angleText}
            </span>
          </div>
        </div>
        
        {/* Watch button */}
        <button className="bg-white text-red-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 group-hover:scale-105 transition-transform shadow-lg">
          <Play className="w-5 h-5" />
          Watch Now
        </button>
      </div>
    </div>
  );
};

export default LiveStreamBanner;
