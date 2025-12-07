import React from 'react';

// Support both simple string/number format and object format
interface TeamInfo {
  name: string;
  abbreviation?: string;
  score: number;
  primaryColor?: string;
}

interface LiveBannerProps {
  // New object format
  homeTeam?: TeamInfo;
  awayTeam?: TeamInfo;
  period?: string;
  timeRemaining?: string;
  // Legacy string format
  team1?: string;
  team2?: string;
  score1?: number;
  score2?: number;
  time?: string;
  // Shared
  sport?: string;
  viewers?: number;
  onWatch?: () => void;
}

export function LiveGameBanner({
  homeTeam,
  awayTeam,
  period = '1st',
  timeRemaining,
  team1,
  team2,
  score1,
  score2,
  time,
  sport = '🏈',
  viewers = 1247,
  onWatch
}: LiveBannerProps) {
  // Normalize to use consistent values
  const displayTeam1 = homeTeam?.name || team1 || 'Home';
  const displayTeam2 = awayTeam?.name || team2 || 'Away';
  const displayScore1 = homeTeam?.score ?? score1 ?? 0;
  const displayScore2 = awayTeam?.score ?? score2 ?? 0;
  const displayTime = timeRemaining || time || '0:00';

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
        borderRadius: '16px',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        boxShadow: '0 10px 30px rgba(220, 38, 38, 0.3)',
        animation: 'pulse-border 2s infinite',
        position: 'relative',
        overflow: 'hidden',
        marginTop: '80px',
        marginLeft: '1.5rem',
        marginRight: '1.5rem'
      }}
    >
      {/* Animated Background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          animation: 'shimmer 2s infinite'
        }}
      />

      {/* Live Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.75rem',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              background: 'white',
              borderRadius: '50%',
              animation: 'pulse 1.5s infinite'
            }}
          />
          LIVE
        </div>
        <span style={{ fontSize: '1.25rem' }}>{sport}</span>
      </div>

      {/* Matchup */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', zIndex: 1 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{displayTeam1}</div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px'
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{displayScore1}</span>
          <span style={{ fontSize: '1rem', opacity: 0.6 }}>-</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{displayScore2}</span>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{displayTeam2}</div>
        </div>
      </div>

      {/* Time & Viewers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 1 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>{period}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{displayTime}</div>
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
          👁 {viewers.toLocaleString()}
        </div>
        <button
          onClick={onWatch}
          style={{
            padding: '0.625rem 1.25rem',
            background: 'white',
            color: '#dc2626',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem'
          }}
        >
          📺 Watch
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 10px 30px rgba(220, 38, 38, 0.3); }
          50% { box-shadow: 0 10px 40px rgba(220, 38, 38, 0.5); }
        }
      `}</style>
    </div>
  );
}

// Compact version for sidebars
export function LiveGameCard({
  homeTeam,
  awayTeam,
  period = '1st',
  timeRemaining,
  team1,
  team2,
  score1,
  score2,
  time,
  sport = '🏈',
  viewers = 847
}: LiveBannerProps) {
  // Normalize values
  const displayTeam1 = homeTeam?.name || team1 || 'Home';
  const displayTeam2 = awayTeam?.name || team2 || 'Away';
  const displayScore1 = homeTeam?.score ?? score1 ?? 0;
  const displayScore2 = awayTeam?.score ?? score2 ?? 0;
  const displayTime = timeRemaining || time || '0:00';

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
        borderRadius: '12px',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'all 0.3s'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase' }}>
          <div style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
          LIVE
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>👁 {viewers?.toLocaleString()}</div>
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>{sport} {displayTeam1} vs {displayTeam2}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{displayScore1} - {displayScore2}</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{period} {displayTime}</div>
      </div>
    </div>
  );
}

export default LiveGameBanner;