import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge, ProgressBar } from './ui/OSYSComponents';

// Types
interface Athlete {
  id: string;
  name: string;
  number: number;
  position: string;
  team: string;
  teamEmoji: string;
  sport: string;
  followers: string;
  isLive?: boolean;
}

interface ActivityItem {
  id: string;
  type: 'post' | 'highlight' | 'kudos' | 'game' | 'fundraiser';
  athleteName: string;
  athleteNumber: number;
  content: string;
  time: string;
  media?: string;
  stats?: { likes: number; comments: number };
}

interface LiveEvent {
  id: string;
  team: string;
  opponent: string;
  sport: string;
  score?: string;
  time: string;
  viewers: number;
}

// Mock Data
const followingAthletes: Athlete[] = [
  { id: '1', name: 'Marcus Johnson', number: 12, position: 'QB', team: 'Eastside Eagles', teamEmoji: '🦅', sport: 'Football', followers: '12.4K', isLive: true },
  { id: '2', name: 'Sarah Chen', number: 23, position: 'PG', team: 'Westside Warriors', teamEmoji: '⚔️', sport: 'Basketball', followers: '8.2K' },
  { id: '3', name: 'DeShawn Williams', number: 24, position: 'RB', team: 'Eastside Eagles', teamEmoji: '🦅', sport: 'Football', followers: '5.1K' },
  { id: '4', name: 'Emma Rodriguez', number: 7, position: 'Forward', team: 'Central Cougars', teamEmoji: '🐆', sport: 'Soccer', followers: '6.8K' },
  { id: '5', name: 'Tyler Smith', number: 88, position: 'WR', team: 'Eastside Eagles', teamEmoji: '🦅', sport: 'Football', followers: '3.9K' },
];

const activityFeed: ActivityItem[] = [
  { 
    id: '1', 
    type: 'highlight', 
    athleteName: 'Marcus Johnson', 
    athleteNumber: 12, 
    content: 'Check out this 65-yard TD bomb! 🔥 #FridayNightLights', 
    time: '15m ago',
    media: '🎬',
    stats: { likes: 342, comments: 47 }
  },
  { 
    id: '2', 
    type: 'kudos', 
    athleteName: 'Sarah Chen', 
    athleteNumber: 23, 
    content: 'Received 5 new kudos after last night\'s game!', 
    time: '1h ago'
  },
  { 
    id: '3', 
    type: 'fundraiser', 
    athleteName: 'DeShawn Williams', 
    athleteNumber: 24, 
    content: 'Training camp fund reached $3,500! 70% to goal 🎯', 
    time: '2h ago'
  },
  { 
    id: '4', 
    type: 'post', 
    athleteName: 'Emma Rodriguez', 
    athleteNumber: 7, 
    content: 'Game day vibes! Ready to give everything on the field today ⚽️', 
    time: '3h ago',
    media: '📸',
    stats: { likes: 156, comments: 23 }
  },
  { 
    id: '5', 
    type: 'game', 
    athleteName: 'Tyler Smith', 
    athleteNumber: 88, 
    content: 'Had 8 catches for 127 yards in last night\'s win!', 
    time: '5h ago',
    stats: { likes: 89, comments: 12 }
  },
];

const liveEvents: LiveEvent[] = [
  { id: '1', team: 'Eastside Eagles', opponent: 'Panthers', sport: '🏈 Football', score: '21-14', time: 'Q3 8:42', viewers: 1247 },
  { id: '2', team: 'Westside Warriors', opponent: 'Lions', sport: '🏀 Basketball', score: '45-38', time: 'Halftime', viewers: 834 },
];

const trendingClips = [
  { id: '1', title: 'Incredible TD catch!', views: '24.5K', athlete: 'Tyler Smith' },
  { id: '2', title: 'Game-winning buzzer beater', views: '18.2K', athlete: 'Sarah Chen' },
  { id: '3', title: 'Unbelievable save!', views: '12.8K', athlete: 'Emma Rodriguez' },
  { id: '4', title: '65-yard TD bomb', views: '8.7K', athlete: 'Marcus Johnson' },
];

const suggestedAthletes: Athlete[] = [
  { id: '6', name: 'Chris Thompson', number: 55, position: 'LB', team: 'Northside Knights', teamEmoji: '🛡️', sport: 'Football', followers: '4.2K' },
  { id: '7', name: 'Maya Williams', number: 11, position: 'Setter', team: 'Central Cougars', teamEmoji: '🐆', sport: 'Volleyball', followers: '7.1K' },
  { id: '8', name: 'Jordan Lee', number: 1, position: 'Pitcher', team: 'Eastside Eagles', teamEmoji: '🦅', sport: 'Baseball', followers: '5.5K' },
];

// Styles
const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--osys-bg-primary)',
    color: 'var(--osys-text-primary)',
    fontFamily: "'Inter', sans-serif",
    position: 'relative' as const,
    overflow: 'hidden'
  },
  nav: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontWeight: 800,
    fontSize: '1.25rem',
    textDecoration: 'none',
    color: 'white'
  },
  navBrandIcon: {
    width: '36px',
    height: '36px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  header: {
    paddingTop: '100px',
    paddingBottom: '2rem',
    textAlign: 'center' as const,
    position: 'relative' as const,
    zIndex: 10
  },
  headerTitle: {
    fontSize: '2.5rem',
    fontWeight: 800,
    marginBottom: '0.5rem'
  },
  headerSubtitle: {
    fontSize: '1.125rem',
    color: 'var(--osys-text-secondary)',
    marginBottom: '2rem'
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem 4rem',
    position: 'relative' as const,
    zIndex: 10
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 300px',
    gap: '1.5rem'
  },
  // Left Sidebar - Following
  followingList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  followingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent'
  },
  followingAvatar: {
    width: '44px',
    height: '44px',
    background: 'var(--osys-gradient-gold)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: 700,
    color: 'var(--osys-bg-primary)',
    position: 'relative' as const,
    flexShrink: 0
  },
  liveIndicator: {
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    width: '14px',
    height: '14px',
    background: '#ef4444',
    borderRadius: '50%',
    border: '2px solid var(--osys-bg-primary)',
    animation: 'pulse 2s infinite'
  },
  followingInfo: {
    flex: 1,
    overflow: 'hidden'
  },
  followingName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  followingMeta: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem'
  },
  // Activity Feed
  activityCard: {
    background: 'var(--osys-glass-bg)',
    border: '1px solid var(--osys-glass-border)',
    borderRadius: '20px',
    overflow: 'hidden',
    marginBottom: '1rem'
  },
  activityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem'
  },
  activityAvatar: {
    width: '44px',
    height: '44px',
    background: 'var(--osys-gradient-gold)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.875rem',
    color: 'var(--osys-bg-primary)'
  },
  activityAuthor: {
    fontWeight: 600,
    fontSize: '0.9375rem'
  },
  activityTime: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)'
  },
  activityContent: {
    padding: '0 1rem 1rem',
    fontSize: '0.9375rem',
    lineHeight: 1.5
  },
  activityMedia: {
    width: '100%',
    aspectRatio: '16/9',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '4rem'
  },
  activityActions: {
    display: 'flex',
    padding: '0.75rem 1rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    gap: '0.5rem'
  },
  activityAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.8125rem',
    color: 'var(--osys-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'transparent',
    border: 'none'
  },
  // Live Now Section
  liveCard: {
    background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    borderRadius: '16px',
    padding: '1rem',
    marginBottom: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  liveHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem'
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em'
  },
  liveDot: {
    width: '6px',
    height: '6px',
    background: 'white',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite'
  },
  liveViewers: {
    fontSize: '0.75rem',
    opacity: 0.8
  },
  liveMatchup: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '0.25rem'
  },
  liveScore: {
    fontSize: '1.5rem',
    fontWeight: 800
  },
  liveTime: {
    fontSize: '0.75rem',
    opacity: 0.8
  },
  // Trending Clips
  clipCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  clipThumbnail: {
    width: '64px',
    height: '48px',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    flexShrink: 0
  },
  clipInfo: {
    flex: 1
  },
  clipTitle: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.125rem'
  },
  clipMeta: {
    fontSize: '0.6875rem',
    color: 'var(--osys-text-tertiary)'
  },
  // Suggested Athletes
  suggestedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    marginBottom: '0.5rem'
  },
  suggestedAvatar: {
    width: '40px',
    height: '40px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    flexShrink: 0
  },
  suggestedInfo: {
    flex: 1
  },
  suggestedName: {
    fontSize: '0.8125rem',
    fontWeight: 600
  },
  suggestedMeta: {
    fontSize: '0.6875rem',
    color: 'var(--osys-text-tertiary)'
  },
  followBtn: {
    padding: '0.375rem 0.75rem',
    background: 'var(--osys-gradient-primary)',
    border: 'none',
    borderRadius: '20px',
    color: 'white',
    fontSize: '0.6875rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  // Activity Type Badges
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '20px',
    fontSize: '0.625rem',
    fontWeight: 600,
    marginLeft: '0.5rem'
  },
  sectionTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
};

// Get activity type badge style
const getTypeBadgeStyle = (type: string) => {
  switch (type) {
    case 'highlight': return { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
    case 'kudos': return { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' };
    case 'fundraiser': return { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' };
    case 'game': return { background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' };
    default: return { background: 'rgba(255,255,255,0.1)', color: 'white' };
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'highlight': return '🎬';
    case 'kudos': return '💫';
    case 'fundraiser': return '💰';
    case 'game': return '📊';
    default: return '📝';
  }
};

// Component
export function OSYSFanHub() {
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'highlights', label: '🎬 Highlights' },
    { id: 'posts', label: '📝 Posts' },
    { id: 'games', label: '🏆 Games' },
    { id: 'fundraisers', label: '💰 Fundraisers' }
  ];

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
          <Button variant="ghost">🔔</Button>
          <Button variant="primary">My Profile</Button>
        </div>
      </nav>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>🏟️ Fan Hub</h1>
        <p style={styles.headerSubtitle}>
          Your personalized feed from athletes you follow
        </p>
        
        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: 'none',
                background: activeFilter === filter.id ? 'var(--osys-gradient-primary)' : 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.contentGrid}>
          {/* Left Sidebar - Following */}
          <div>
            <GlassCard>
              <div style={styles.sectionTitle}>
                <span>👥 Following</span>
                <a href="#" style={{ fontSize: '0.75rem', color: 'var(--osys-primary-light)', textDecoration: 'none' }}>See All</a>
              </div>
              <div style={styles.followingList}>
                {followingAthletes.map(athlete => (
                  <div key={athlete.id} style={styles.followingItem}>
                    <div style={styles.followingAvatar}>
                      {athlete.number}
                      {athlete.isLive && <div style={styles.liveIndicator} />}
                    </div>
                    <div style={styles.followingInfo}>
                      <div style={styles.followingName}>{athlete.name}</div>
                      <div style={styles.followingMeta}>
                        <span>{athlete.teamEmoji}</span>
                        <span>{athlete.position}</span>
                        <span>•</span>
                        <span>{athlete.followers}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Discover Athletes */}
            <GlassCard style={{ marginTop: '1.5rem' }}>
              <div style={styles.sectionTitle}>
                <span>✨ Discover</span>
              </div>
              {suggestedAthletes.map(athlete => (
                <div key={athlete.id} style={styles.suggestedCard}>
                  <div style={styles.suggestedAvatar}>{athlete.number}</div>
                  <div style={styles.suggestedInfo}>
                    <div style={styles.suggestedName}>{athlete.name}</div>
                    <div style={styles.suggestedMeta}>{athlete.position} • {athlete.team}</div>
                  </div>
                  <button style={styles.followBtn}>Follow</button>
                </div>
              ))}
            </GlassCard>
          </div>

          {/* Main Feed */}
          <div>
            {activityFeed.map(activity => (
              <div key={activity.id} style={styles.activityCard}>
                <div style={styles.activityHeader}>
                  <div style={styles.activityAvatar}>{activity.athleteNumber}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={styles.activityAuthor}>{activity.athleteName}</span>
                      <span style={{ ...styles.typeBadge, ...getTypeBadgeStyle(activity.type) }}>
                        {getTypeIcon(activity.type)} {activity.type}
                      </span>
                    </div>
                    <div style={styles.activityTime}>{activity.time}</div>
                  </div>
                </div>
                <div style={styles.activityContent}>{activity.content}</div>
                {activity.media && (
                  <div style={styles.activityMedia}>{activity.media}</div>
                )}
                <div style={styles.activityActions}>
                  <button style={styles.activityAction}>❤️ {activity.stats?.likes || 0}</button>
                  <button style={styles.activityAction}>💬 {activity.stats?.comments || 0}</button>
                  <button style={styles.activityAction}>🔄 Share</button>
                  <button style={styles.activityAction}>🔖 Save</button>
                </div>
              </div>
            ))}
          </div>

          {/* Right Sidebar */}
          <div>
            {/* Live Now */}
            <GlassCard style={{ marginBottom: '1.5rem' }}>
              <div style={styles.sectionTitle}>
                <span>🔴 Live Now</span>
                <Badge variant="live">2</Badge>
              </div>
              {liveEvents.map(event => (
                <div key={event.id} style={styles.liveCard}>
                  <div style={styles.liveHeader}>
                    <div style={styles.liveBadge}>
                      <div style={styles.liveDot} />
                      <span>LIVE</span>
                    </div>
                    <div style={styles.liveViewers}>👁 {event.viewers.toLocaleString()}</div>
                  </div>
                  <div style={styles.liveMatchup}>{event.sport}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={styles.liveMatchup}>{event.team} vs {event.opponent}</div>
                      <div style={styles.liveTime}>{event.time}</div>
                    </div>
                    <div style={styles.liveScore}>{event.score}</div>
                  </div>
                </div>
              ))}
              <Button variant="ghost" style={{ width: '100%', marginTop: '0.5rem' }}>
                📺 View All Live Games
              </Button>
            </GlassCard>

            {/* Trending Clips */}
            <GlassCard style={{ marginBottom: '1.5rem' }}>
              <div style={styles.sectionTitle}>
                <span>🔥 Trending Clips</span>
              </div>
              {trendingClips.map(clip => (
                <div key={clip.id} style={styles.clipCard}>
                  <div style={styles.clipThumbnail}>▶️</div>
                  <div style={styles.clipInfo}>
                    <div style={styles.clipTitle}>{clip.title}</div>
                    <div style={styles.clipMeta}>{clip.athlete} • {clip.views} views</div>
                  </div>
                </div>
              ))}
            </GlassCard>

            {/* Create Clip CTA */}
            <GlassCard>
              <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎬</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Create Your Clip</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--osys-text-secondary)', marginBottom: '1rem' }}>
                  Make highlight clips of your favorite moments
                </p>
                <Button variant="gold" style={{ width: '100%' }}>
                  ✂️ Start Creating
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (max-width: 1200px) {
          .content-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .content-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default OSYSFanHub;
