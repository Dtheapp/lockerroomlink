import React, { useState, useEffect } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge } from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';
import { useDemoToast } from '../hooks/useOSYSData';

// Types
interface ChatMessage {
  id: string;
  user: string;
  message: string;
  time: string;
  isModerator?: boolean;
  isAthlete?: boolean;
}

interface Viewer {
  id: string;
  name: string;
  avatar: string;
}

// Mock Data
const mockGame = {
  homeTeam: {
    name: "Riverside Wildcats",
    abbreviation: "WLD",
    score: 28,
    emoji: "🐾",
    primaryColor: "#667eea",
    timeouts: 2
  },
  awayTeam: {
    name: "Valley Tigers",
    abbreviation: "TGR", 
    score: 21,
    emoji: "🐯",
    primaryColor: "#f59e0b",
    timeouts: 1
  },
  period: "3rd Quarter",
  timeRemaining: "5:42",
  venue: "Memorial Stadium",
  weather: "72°F Partly Cloudy"
};

const mockStats = {
  home: {
    totalYards: 285,
    passingYards: 185,
    rushingYards: 100,
    firstDowns: 14,
    turnovers: 1,
    penalties: "4-35",
    timeOfPossession: "18:24"
  },
  away: {
    totalYards: 248,
    passingYards: 156,
    rushingYards: 92,
    firstDowns: 12,
    turnovers: 2,
    penalties: "6-45",
    timeOfPossession: "14:54"
  }
};

const mockChatMessages: ChatMessage[] = [
  { id: '1', user: 'ProudDad42', message: 'Great catch by #23! 🙌', time: '2m ago' },
  { id: '2', user: 'WildcatsFan', message: 'TOUCHDOWN!!!', time: '2m ago', isModerator: true },
  { id: '3', user: 'Coach_M', message: 'Defense looking strong today', time: '3m ago', isAthlete: true },
  { id: '4', user: 'SoccerMom', message: 'My son is #15! Go Marcus! 💪', time: '3m ago' },
  { id: '5', user: 'TigerNation', message: 'Good game so far!', time: '4m ago' },
  { id: '6', user: 'LocalReporter', message: 'Impressive drive by the Wildcats offense', time: '5m ago' },
  { id: '7', user: 'Grandpa_Joe', message: 'Watching from Florida! Go Wildcats!', time: '5m ago' },
  { id: '8', user: 'Coach_M', message: 'Great blocking on that play', time: '6m ago', isAthlete: true },
];

const mockHighlights = [
  { id: '1', title: '45-yard TD Pass', time: '2nd Q 8:32', thumbnail: '🏈' },
  { id: '2', title: 'Interception Return', time: '2nd Q 4:15', thumbnail: '🏃' },
  { id: '3', title: '22-yard Field Goal', time: '1st Q 0:03', thumbnail: '⚽' },
];

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--osys-bg-dark)',
    color: 'white',
    fontFamily: 'Inter, system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden'
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    position: 'relative',
    zIndex: 10
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'white',
    textDecoration: 'none'
  },
  navBrandIcon: {
    width: '40px',
    height: '40px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '1rem',
    padding: '0 2rem 2rem',
    maxWidth: '1800px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1
  },
  videoSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem'
  },
  videoContainer: {
    position: 'relative' as const,
    aspectRatio: '16/9',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    background: 'radial-gradient(circle at center, rgba(102,126,234,0.2) 0%, transparent 70%)'
  },
  playButton: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'var(--osys-gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    cursor: 'pointer',
    transition: 'transform 0.3s',
    boxShadow: '0 0 40px rgba(102,126,234,0.5)'
  },
  liveIndicator: {
    position: 'absolute' as const,
    top: '1rem',
    left: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(239,68,68,0.9)',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontWeight: 600,
    fontSize: '0.875rem'
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'white',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  viewerCount: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(0,0,0,0.7)',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontSize: '0.875rem'
  },
  videoControls: {
    position: 'absolute' as const,
    bottom: '0',
    left: '0',
    right: '0',
    padding: '1rem',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  progressBar: {
    flex: 1,
    height: '4px',
    background: 'rgba(255,255,255,0.3)',
    borderRadius: '2px',
    cursor: 'pointer'
  },
  progressFill: {
    width: '65%',
    height: '100%',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '2px'
  },
  scoreboard: {
    background: 'linear-gradient(135deg, rgba(26,26,46,0.95) 0%, rgba(22,33,62,0.95) 100%)',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)'
  },
  scoreboardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  },
  scoreboardTitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px'
  },
  scoreboardLive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#ef4444',
    fontWeight: 600,
    fontSize: '0.875rem'
  },
  teamsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem'
  },
  teamScore: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem'
  },
  teamLogo: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem'
  },
  teamName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'white'
  },
  score: {
    fontSize: '2.5rem',
    fontWeight: 700,
    background: 'var(--osys-gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  vsText: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 600
  },
  gameInfo: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  gameInfoItem: {
    textAlign: 'center' as const
  },
  gameInfoLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    marginBottom: '0.25rem'
  },
  gameInfoValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'white'
  },
  tabsContainer: {
    display: 'flex',
    gap: '0.5rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '0.25rem'
  },
  tab: {
    flex: 1,
    padding: '0.75rem 1rem',
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabActive: {
    background: 'var(--osys-gradient-primary)',
    color: 'white'
  },
  statsGrid: {
    display: 'grid',
    gap: '0.75rem',
    marginTop: '1rem'
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  statLabel: {
    flex: 1,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center' as const
  },
  statValue: {
    width: '60px',
    textAlign: 'center' as const,
    fontSize: '1rem',
    fontWeight: 600
  },
  statBar: {
    flex: 2,
    height: '6px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    display: 'flex'
  },
  statBarHome: {
    background: 'var(--osys-gradient-primary)',
    transition: 'width 0.5s'
  },
  statBarAway: {
    background: 'linear-gradient(90deg, #f59e0b, #f97316)',
    transition: 'width 0.5s'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    height: 'calc(100vh - 100px)',
    position: 'sticky' as const,
    top: '1rem'
  },
  chatContainer: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden'
  },
  chatHeader: {
    padding: '1rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chatTitle: {
    fontWeight: 600,
    fontSize: '1rem'
  },
  chatOnline: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  chatMessages: {
    flex: 1,
    padding: '1rem',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem'
  },
  chatMessage: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'
  },
  chatUser: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem'
  },
  chatUserName: {
    fontWeight: 600,
    color: 'white'
  },
  chatUserBadge: {
    padding: '0.125rem 0.5rem',
    borderRadius: '8px',
    fontSize: '0.625rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const
  },
  chatTime: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)'
  },
  chatText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.4
  },
  chatInput: {
    padding: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    gap: '0.5rem'
  },
  chatInputField: {
    flex: 1,
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: 'white',
    fontSize: '0.875rem',
    outline: 'none'
  },
  highlightsList: {
    display: 'flex',
    gap: '0.75rem',
    overflowX: 'auto' as const,
    padding: '0.5rem 0'
  },
  highlightCard: {
    minWidth: '200px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '1rem',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  highlightThumbnail: {
    width: '100%',
    height: '80px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    marginBottom: '0.75rem'
  },
  highlightTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  highlightTime: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)'
  },
  donateSection: {
    background: 'linear-gradient(135deg, rgba(234,179,8,0.2) 0%, rgba(245,158,11,0.1) 100%)',
    borderRadius: '16px',
    padding: '1rem',
    border: '1px solid rgba(234,179,8,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  donateIcon: {
    width: '48px',
    height: '48px',
    background: 'var(--osys-gradient-gold)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem'
  },
  donateText: {
    flex: 1
  },
  donateTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  donateSubtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)'
  }
};

// Inject keyframes
const injectKeyframes = () => {
  if (typeof document !== 'undefined' && !document.getElementById('osys-livestream-keyframes')) {
    const style = document.createElement('style');
    style.id = 'osys-livestream-keyframes';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
};

export const OSYSLivestream: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stats' | 'roster' | 'play'>('stats');
  const [chatMessage, setChatMessage] = useState('');
  const [viewerCount, setViewerCount] = useState(1247);
  const { showToast, ToastComponent } = useDemoToast();

  useEffect(() => {
    injectKeyframes();
    // Simulate viewer count fluctuation
    const interval = setInterval(() => {
      setViewerCount(prev => prev + Math.floor(Math.random() * 10) - 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const calculatePercent = (home: number, away: number) => {
    const total = home + away;
    if (total === 0) return { home: 50, away: 50 };
    return {
      home: (home / total) * 100,
      away: (away / total) * 100
    };
  };

  return (
    <div style={styles.page}>
      <AnimatedBackground />
      
      {/* Navigation */}
      <nav style={styles.nav}>
        <a href="/welcome" style={styles.navBrand}>
          <div style={styles.navBrandIcon}>🏆</div>
          <span>OSYS</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="ghost" onClick={() => showToast('No new notifications', 'info')}>🔔</Button>
          <Button variant="gold" onClick={() => showToast('Donation coming soon!', 'info')}>💰 Donate</Button>
          <Button variant="primary" onClick={() => showToast('Link copied!', 'success')}>Share Stream</Button>
        </div>
      </nav>

      <div style={styles.mainContent}>
        {/* Video & Info Section */}
        <div style={styles.videoSection}>
          {/* Video Player */}
          <div style={styles.videoContainer}>
            <div style={styles.videoPlaceholder}>
              <div style={styles.playButton}>▶</div>
              <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>Live Stream</p>
            </div>
            
            {/* Live Indicator */}
            <div style={styles.liveIndicator}>
              <div style={styles.liveDot} />
              LIVE
            </div>

            {/* Viewer Count */}
            <div style={styles.viewerCount}>
              👁 {viewerCount.toLocaleString()} watching
            </div>

            {/* Video Controls */}
            <div style={styles.videoControls}>
              <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer' }} onClick={() => showToast('Play/Pause coming soon!', 'info')}>
                ⏸
              </button>
              <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer' }} onClick={() => showToast('Volume control coming soon!', 'info')}>
                🔊
              </button>
              <div style={styles.progressBar}>
                <div style={styles.progressFill} />
              </div>
              <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>LIVE</span>
              <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.25rem', cursor: 'pointer' }} onClick={() => showToast('Fullscreen coming soon!', 'info')}>
                ⛶
              </button>
            </div>
          </div>

          {/* Scoreboard */}
          <div style={styles.scoreboard}>
            <div style={styles.scoreboardHeader}>
              <span style={styles.scoreboardTitle}>{mockGame.venue}</span>
              <span style={styles.scoreboardLive}>
                <span style={{ ...styles.liveDot, background: '#ef4444' }} />
                LIVE
              </span>
            </div>
            
            <div style={styles.teamsRow}>
              <div style={styles.teamScore}>
                <div style={{ ...styles.teamLogo, background: mockGame.homeTeam.primaryColor }}>
                  {mockGame.homeTeam.emoji}
                </div>
                <span style={styles.teamName}>{mockGame.homeTeam.abbreviation}</span>
                <span style={styles.score}>{mockGame.homeTeam.score}</span>
              </div>
              
              <span style={styles.vsText}>VS</span>
              
              <div style={styles.teamScore}>
                <div style={{ ...styles.teamLogo, background: mockGame.awayTeam.primaryColor }}>
                  {mockGame.awayTeam.emoji}
                </div>
                <span style={styles.teamName}>{mockGame.awayTeam.abbreviation}</span>
                <span style={styles.score}>{mockGame.awayTeam.score}</span>
              </div>
            </div>

            <div style={styles.gameInfo}>
              <div style={styles.gameInfoItem}>
                <div style={styles.gameInfoLabel}>Period</div>
                <div style={styles.gameInfoValue}>{mockGame.period}</div>
              </div>
              <div style={styles.gameInfoItem}>
                <div style={styles.gameInfoLabel}>Time</div>
                <div style={styles.gameInfoValue}>{mockGame.timeRemaining}</div>
              </div>
              <div style={styles.gameInfoItem}>
                <div style={styles.gameInfoLabel}>Weather</div>
                <div style={styles.gameInfoValue}>☀️ {mockGame.weather}</div>
              </div>
            </div>
          </div>

          {/* Stats/Roster Tabs */}
          <div style={styles.tabsContainer}>
            {['stats', 'roster', 'play'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab ? styles.tabActive : {})
                }}
              >
                {tab === 'stats' && '📊 Stats'}
                {tab === 'roster' && '👥 Roster'}
                {tab === 'play' && '🎮 Play-by-Play'}
              </button>
            ))}
          </div>

          {/* Stats Content */}
          {activeTab === 'stats' && (
            <GlassCard>
              <div style={styles.statsGrid}>
                {[
                  { label: 'Total Yards', home: mockStats.home.totalYards, away: mockStats.away.totalYards },
                  { label: 'Passing Yards', home: mockStats.home.passingYards, away: mockStats.away.passingYards },
                  { label: 'Rushing Yards', home: mockStats.home.rushingYards, away: mockStats.away.rushingYards },
                  { label: 'First Downs', home: mockStats.home.firstDowns, away: mockStats.away.firstDowns },
                  { label: 'Turnovers', home: mockStats.home.turnovers, away: mockStats.away.turnovers, inverse: true }
                ].map(stat => {
                  const percent = calculatePercent(
                    stat.inverse ? stat.away : stat.home,
                    stat.inverse ? stat.home : stat.away
                  );
                  return (
                    <div key={stat.label} style={styles.statRow}>
                      <div style={styles.statValue}>{stat.home}</div>
                      <div style={styles.statBar}>
                        <div style={{ ...styles.statBarHome, width: `${percent.home}%` }} />
                        <div style={{ ...styles.statBarAway, width: `${percent.away}%` }} />
                      </div>
                      <div style={styles.statLabel}>{stat.label}</div>
                      <div style={styles.statBar}>
                        <div style={{ ...styles.statBarAway, width: `${percent.away}%` }} />
                        <div style={{ ...styles.statBarHome, width: `${percent.home}%` }} />
                      </div>
                      <div style={styles.statValue}>{stat.away}</div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {/* Highlights */}
          <GlassCard>
            <h3 style={{ margin: '0 0 1rem', fontWeight: 600 }}>📹 Game Highlights</h3>
            <div style={styles.highlightsList}>
              {mockHighlights.map(highlight => (
                <div key={highlight.id} style={styles.highlightCard}>
                  <div style={styles.highlightThumbnail}>{highlight.thumbnail}</div>
                  <div style={styles.highlightTitle}>{highlight.title}</div>
                  <div style={styles.highlightTime}>{highlight.time}</div>
                </div>
              ))}
              <div style={{ ...styles.highlightCard, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '140px' }}>
                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>➕</span>
                <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>More highlights soon</span>
              </div>
            </div>
          </GlassCard>

          {/* Support the Team */}
          <div style={styles.donateSection}>
            <div style={styles.donateIcon}>🎗️</div>
            <div style={styles.donateText}>
              <div style={styles.donateTitle}>Support {mockGame.homeTeam.name}</div>
              <div style={styles.donateSubtitle}>Help fund new equipment for the team</div>
            </div>
            <Button variant="gold" onClick={() => showToast('Donation coming soon! Thank you!', 'success')}>💰 Donate Now</Button>
          </div>
        </div>

        {/* Sidebar - Chat */}
        <div style={styles.sidebar}>
          <div style={styles.chatContainer}>
            <div style={styles.chatHeader}>
              <span style={styles.chatTitle}>💬 Live Chat</span>
              <span style={styles.chatOnline}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                {Math.floor(viewerCount * 0.4)} chatting
              </span>
            </div>
            
            <div style={styles.chatMessages}>
              {mockChatMessages.map(msg => (
                <div key={msg.id} style={styles.chatMessage}>
                  <div style={styles.chatUser}>
                    <span style={styles.chatUserName}>{msg.user}</span>
                    {msg.isModerator && (
                      <span style={{ ...styles.chatUserBadge, background: '#22c55e' }}>MOD</span>
                    )}
                    {msg.isAthlete && (
                      <span style={{ ...styles.chatUserBadge, background: 'var(--osys-gradient-primary)' }}>COACH</span>
                    )}
                    <span style={styles.chatTime}>{msg.time}</span>
                  </div>
                  <div style={styles.chatText}>{msg.message}</div>
                </div>
              ))}
            </div>

            <div style={styles.chatInput}>
              <input
                type="text"
                placeholder="Send a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                style={styles.chatInputField}
              />
              <Button variant="primary" onClick={() => { showToast('Message sent!', 'success'); setChatMessage(''); }}>Send</Button>
            </div>
          </div>

          {/* Quick Stats */}
          <GlassCard>
            <h4 style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.875rem' }}>⚡ Quick Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Screenshot saved!', 'success')}>📸 Share Screenshot</Button>
              <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Clip creator coming soon!', 'info')}>✂️ Create Clip</Button>
              <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Gifts coming soon!', 'info')}>🎁 Send Gift</Button>
              <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Added to calendar!', 'success')}>📅 Add to Calendar</Button>
            </div>
          </GlassCard>
        </div>
      </div>

      <DemoNavigation />
      {ToastComponent}
    </div>
  );
};

export default OSYSLivestream;
