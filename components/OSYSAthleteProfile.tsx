import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, GlassPanel, Button, Badge, GradientText, ProgressBar } from './ui/OSYSComponents';

// Types
interface AthleteStats {
  label: string;
  value: string | number;
}

interface GameStats {
  opponent: string;
  comp: string;
  yards: number;
  td: number;
  int: number;
  rating: number;
}

interface Highlight {
  id: string;
  title: string;
  duration: string;
  views: string;
  thumbnail?: string;
}

interface Achievement {
  icon: string;
  title: string;
  description: string;
}

interface KudosItem {
  id: string;
  from: string;
  initials: string;
  message: string;
  time: string;
}

interface Post {
  id: string;
  content: string;
  media?: string;
  mediaType?: 'image' | 'video';
  likes: number;
  comments: number;
  shares: number;
  time: string;
}

// Mock Data
const mockAthlete = {
  name: 'Marcus Johnson',
  number: 12,
  position: 'Quarterback',
  classYear: '2026',
  team: 'Eastside Eagles',
  teamLevel: 'Varsity',
  location: 'Atlanta, GA',
  height: '6\'2"',
  weight: '185 lbs',
  starRating: 4,
  age: 16,
  followers: '12.4K',
  following: 847,
  posts: 156,
  kudos: 247,
  bio: 'Committed to greatness. Work hard, stay humble. 🏈 #GodFirst'
};

const heroStats: AthleteStats[] = [
  { label: 'Pass Yards', value: '1,847' },
  { label: 'Touchdowns', value: 18 },
  { label: 'Comp %', value: '67%' },
  { label: 'QBR', value: 142.3 }
];

const gameStats: GameStats[] = [
  { opponent: 'vs. Panthers', comp: '18/24', yards: 245, td: 3, int: 0, rating: 156.2 },
  { opponent: '@ Tigers', comp: '21/32', yards: 287, td: 2, int: 1, rating: 128.4 },
  { opponent: 'vs. Bears', comp: '15/22', yards: 198, td: 2, int: 0, rating: 145.8 },
  { opponent: '@ Bulldogs', comp: '22/28', yards: 312, td: 4, int: 0, rating: 162.1 },
  { opponent: 'vs. Lions', comp: '19/25', yards: 256, td: 3, int: 1, rating: 138.9 }
];

const highlights: Highlight[] = [
  { id: '1', title: '65-Yard TD Bomb vs Panthers', duration: '0:45', views: '2.3K' },
  { id: '2', title: 'Game-Winning Drive', duration: '2:15', views: '5.1K' },
  { id: '3', title: 'Season Highlights Mix', duration: '4:30', views: '8.7K' },
  { id: '4', title: 'Scramble TD vs Tigers', duration: '0:32', views: '1.8K' }
];

const achievements: Achievement[] = [
  { icon: '🏆', title: 'Player of the Week', description: 'Week 4 - 312 yards, 4 TDs' },
  { icon: '⭐', title: 'All-District First Team', description: '2024 Season' },
  { icon: '🎯', title: '100 Career TDs', description: 'Milestone Achievement' },
  { icon: '🔥', title: 'Hot Streak', description: '5 games with 200+ yards' }
];

const kudosItems: KudosItem[] = [
  { id: '1', from: 'Coach Williams', initials: 'CW', message: 'Outstanding leadership on the field today! Keep pushing!', time: '2h ago' },
  { id: '2', from: 'Dad', initials: 'DJ', message: 'So proud of you son! Amazing game!', time: '3h ago' },
  { id: '3', from: 'Emily Martinez', initials: 'EM', message: 'That TD pass was incredible! 🔥', time: '5h ago' },
  { id: '4', from: 'Mike Thompson', initials: 'MT', message: 'Best QB in the state! Keep grinding!', time: '1d ago' }
];

const posts: Post[] = [
  {
    id: '1',
    content: 'Game day vibes! Ready to leave it all on the field tonight. Let\'s get this W! 🏈🔥 #EaglesFootball #FridayNightLights',
    media: '🏈',
    mediaType: 'image',
    likes: 342,
    comments: 47,
    shares: 12,
    time: '2h ago'
  },
  {
    id: '2',
    content: 'Grateful for another opportunity to compete. Hard work pays off. Thank you to everyone who supports me on this journey. #Blessed #WorkInProgress',
    likes: 528,
    comments: 89,
    shares: 24,
    time: '1d ago'
  },
  {
    id: '3',
    content: 'Film study never stops. Always looking for ways to improve. 📚🎬 #StudentOfTheGame',
    media: '📚',
    mediaType: 'image',
    likes: 215,
    comments: 31,
    shares: 8,
    time: '3d ago'
  }
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
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  },
  heroBanner: {
    height: '280px',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
    position: 'relative' as const,
    marginTop: '60px'
  },
  heroGradient: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '150px',
    background: 'linear-gradient(to top, var(--osys-bg-primary) 0%, transparent 100%)'
  },
  profileHeader: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem',
    position: 'relative' as const,
    marginTop: '-100px',
    zIndex: 10
  },
  profileCard: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const
  },
  avatar: {
    width: '180px',
    height: '180px',
    borderRadius: '20px',
    background: 'var(--osys-gradient-gold)',
    border: '4px solid var(--osys-bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '4rem',
    fontWeight: 800,
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    position: 'relative' as const,
    color: 'var(--osys-bg-primary)'
  },
  avatarBadge: {
    position: 'absolute' as const,
    bottom: '-8px',
    right: '-8px',
    width: '48px',
    height: '48px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    border: '3px solid var(--osys-bg-primary)'
  },
  profileInfo: {
    flex: 1,
    paddingBottom: '1rem',
    minWidth: '300px'
  },
  teamBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: '0.75rem'
  },
  profileName: {
    fontSize: '2.5rem',
    fontWeight: 800,
    marginBottom: '0.25rem'
  },
  profilePosition: {
    fontSize: '1.125rem',
    color: 'var(--osys-text-secondary)',
    marginBottom: '1rem'
  },
  profileMeta: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap' as const
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--osys-text-secondary)'
  },
  profileActions: {
    display: 'flex',
    gap: '0.75rem',
    paddingBottom: '1rem',
    flexWrap: 'wrap' as const
  },
  socialStatsBar: {
    display: 'flex',
    gap: '1.5rem',
    marginTop: '1.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  socialStat: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  socialStatValue: {
    fontSize: '1.25rem',
    fontWeight: 700
  },
  socialStatLabel: {
    fontSize: '0.6875rem',
    color: 'var(--osys-text-tertiary)',
    textTransform: 'uppercase' as const
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    position: 'relative' as const,
    zIndex: 10
  },
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '1.5rem',
    overflowX: 'auto' as const
  },
  tab: {
    padding: '1rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--osys-text-tertiary)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'transparent',
    border: 'none'
  },
  tabActive: {
    color: 'white',
    borderBottomColor: 'var(--osys-primary)'
  },
  tabBadge: {
    background: 'var(--osys-primary)',
    padding: '0.125rem 0.5rem',
    borderRadius: '10px',
    fontSize: '0.6875rem',
    fontWeight: 600
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1.5rem'
  },
  statsHero: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  statHeroItem: {
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    padding: '1.25rem',
    textAlign: 'center' as const
  },
  statHeroValue: {
    fontSize: '2rem',
    fontWeight: 800,
    background: 'var(--osys-gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  statHeroLabel: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.75rem',
    fontSize: '0.625rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'var(--osys-text-tertiary)',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  td: {
    padding: '0.75rem',
    fontSize: '0.875rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  highlightsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem'
  },
  highlightCard: {
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  highlightThumbnail: {
    height: '120px',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const
  },
  highlightPlayBtn: {
    width: '48px',
    height: '48px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    fontSize: '1.25rem'
  },
  highlightDuration: {
    position: 'absolute' as const,
    bottom: '8px',
    right: '8px',
    padding: '0.25rem 0.5rem',
    background: 'rgba(0,0,0,0.7)',
    borderRadius: '4px',
    fontSize: '0.625rem',
    fontWeight: 500
  },
  highlightInfo: {
    padding: '0.75rem'
  },
  highlightTitle: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  highlightMeta: {
    fontSize: '0.6875rem',
    color: 'var(--osys-text-tertiary)'
  },
  nilBanner: {
    background: 'var(--osys-gradient-gold)',
    borderRadius: '20px',
    padding: '1.5rem',
    color: 'var(--osys-bg-primary)',
    marginBottom: '1.5rem'
  },
  nilTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '0.5rem'
  },
  nilDescription: {
    fontSize: '0.875rem',
    opacity: 0.8,
    marginBottom: '1rem'
  },
  nilStats: {
    display: 'flex',
    gap: '2rem'
  },
  nilStat: {
    textAlign: 'center' as const
  },
  nilStatValue: {
    fontSize: '1.5rem',
    fontWeight: 800
  },
  nilStatLabel: {
    fontSize: '0.625rem',
    textTransform: 'uppercase' as const,
    opacity: 0.7
  },
  achievementItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    marginBottom: '0.75rem'
  },
  achievementIcon: {
    width: '48px',
    height: '48px',
    background: 'var(--osys-gradient-gold)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    flexShrink: 0
  },
  achievementTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.125rem'
  },
  achievementDesc: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)'
  },
  kudosItem: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1rem',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    marginBottom: '0.75rem'
  },
  kudosAvatar: {
    width: '36px',
    height: '36px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 600,
    flexShrink: 0
  },
  kudosContent: {
    flex: 1
  },
  kudosHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem'
  },
  kudosName: {
    fontSize: '0.8125rem',
    fontWeight: 600
  },
  kudosTime: {
    fontSize: '0.6875rem',
    color: 'var(--osys-text-tertiary)'
  },
  kudosText: {
    fontSize: '0.8125rem',
    color: 'var(--osys-text-secondary)',
    lineHeight: 1.4
  },
  postCard: {
    background: 'var(--osys-glass-bg)',
    border: '1px solid var(--osys-glass-border)',
    borderRadius: '20px',
    overflow: 'hidden',
    marginBottom: '1rem'
  },
  postHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem'
  },
  postAvatar: {
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
  postAuthor: {
    fontWeight: 600,
    fontSize: '0.9375rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem'
  },
  postTime: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)'
  },
  postContent: {
    padding: '0 1rem 1rem',
    fontSize: '0.9375rem',
    lineHeight: 1.5
  },
  postMedia: {
    width: '100%',
    aspectRatio: '16/9',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '4rem'
  },
  postActions: {
    display: 'flex',
    padding: '0.75rem 1rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    gap: '0.5rem'
  },
  postAction: {
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
  sidebarCard: {
    marginBottom: '1.5rem'
  }
};

// Component
export function OSYSAthleteProfile() {
  const [activeTab, setActiveTab] = useState('stats');
  const [isFollowing, setIsFollowing] = useState(false);

  const tabs = [
    { id: 'stats', label: '📊 Stats' },
    { id: 'posts', label: '📝 Posts', badge: mockAthlete.posts },
    { id: 'highlights', label: '🎬 Highlights' },
    { id: 'achievements', label: '🏆 Achievements' },
    { id: 'kudos', label: '💫 Kudos' }
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
        <div style={styles.navRight}>
          <Button variant="ghost">🔔</Button>
          <Button variant="primary">Sign In</Button>
        </div>
      </nav>

      {/* Hero Banner */}
      <div style={styles.heroBanner}>
        <div style={styles.heroGradient} />
      </div>

      {/* Profile Header */}
      <div style={styles.profileHeader}>
        <div style={styles.profileCard}>
          <div style={styles.avatar}>
            {mockAthlete.number}
            <div style={styles.avatarBadge}>⭐</div>
          </div>
          
          <div style={styles.profileInfo}>
            <div style={styles.teamBadge}>
              <span>🦅</span>
              {mockAthlete.team} • {mockAthlete.teamLevel}
            </div>
            <h1 style={styles.profileName}>{mockAthlete.name}</h1>
            <p style={styles.profilePosition}>
              {mockAthlete.position} • Class of {mockAthlete.classYear}
            </p>
            <div style={styles.profileMeta}>
              <span style={styles.metaItem}>📍 {mockAthlete.location}</span>
              <span style={styles.metaItem}>📏 {mockAthlete.height} • {mockAthlete.weight}</span>
              <span style={styles.metaItem}>⭐ {mockAthlete.starRating}-Star Recruit</span>
              <span style={styles.metaItem}>🎂 {mockAthlete.age} years old</span>
            </div>
            
            <div style={styles.socialStatsBar}>
              <div style={styles.socialStat}>
                <span style={styles.socialStatValue}>{mockAthlete.followers}</span>
                <span style={styles.socialStatLabel}>Followers</span>
              </div>
              <div style={styles.socialStat}>
                <span style={styles.socialStatValue}>{mockAthlete.following}</span>
                <span style={styles.socialStatLabel}>Following</span>
              </div>
              <div style={styles.socialStat}>
                <span style={styles.socialStatValue}>{mockAthlete.posts}</span>
                <span style={styles.socialStatLabel}>Posts</span>
              </div>
              <div style={styles.socialStat}>
                <span style={styles.socialStatValue}>{mockAthlete.kudos}</span>
                <span style={styles.socialStatLabel}>Kudos</span>
              </div>
            </div>
          </div>

          <div style={styles.profileActions}>
            <Button 
              variant={isFollowing ? 'ghost' : 'primary'}
              onClick={() => setIsFollowing(!isFollowing)}
            >
              {isFollowing ? '✓ Following' : '➕ Follow'}
            </Button>
            <Button variant="gold">💫 Send Kudos</Button>
            <Button variant="primary">💬 Message</Button>
            <Button variant="ghost">🔗 Share</Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Tabs */}
        <div style={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {})
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.badge && <span style={styles.tabBadge}>{tab.badge}</span>}
            </button>
          ))}
        </div>

        <div style={styles.contentGrid}>
          {/* Main Column */}
          <div>
            {activeTab === 'stats' && (
              <>
                {/* Hero Stats */}
                <div style={styles.statsHero}>
                  {heroStats.map((stat, i) => (
                    <div key={i} style={styles.statHeroItem}>
                      <div style={styles.statHeroValue}>{stat.value}</div>
                      <div style={styles.statHeroLabel}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Season Stats Table */}
                <GlassCard>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>2025 Season Stats</h2>
                    <a href="#" style={{ fontSize: '0.75rem', color: 'var(--osys-primary-light)', textDecoration: 'none' }}>View All Seasons →</a>
                  </div>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Game</th>
                        <th style={styles.th}>Comp/Att</th>
                        <th style={styles.th}>Yards</th>
                        <th style={styles.th}>TD</th>
                        <th style={styles.th}>INT</th>
                        <th style={styles.th}>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gameStats.map((game, i) => (
                        <tr key={i}>
                          <td style={styles.td}>{game.opponent}</td>
                          <td style={styles.td}>{game.comp}</td>
                          <td style={styles.td}>{game.yards}</td>
                          <td style={styles.td}>{game.td}</td>
                          <td style={styles.td}>{game.int}</td>
                          <td style={styles.td}>{game.rating}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>

                {/* Highlights */}
                <GlassCard style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>🎬 Highlights</h2>
                    <a href="#" style={{ fontSize: '0.75rem', color: 'var(--osys-primary-light)', textDecoration: 'none' }}>View All →</a>
                  </div>
                  <div style={styles.highlightsGrid}>
                    {highlights.map(highlight => (
                      <div key={highlight.id} style={styles.highlightCard}>
                        <div style={styles.highlightThumbnail}>
                          <div style={styles.highlightPlayBtn}>▶</div>
                          <span style={styles.highlightDuration}>{highlight.duration}</span>
                        </div>
                        <div style={styles.highlightInfo}>
                          <div style={styles.highlightTitle}>{highlight.title}</div>
                          <div style={styles.highlightMeta}>{highlight.views} views</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </>
            )}

            {activeTab === 'posts' && (
              <div>
                {posts.map(post => (
                  <div key={post.id} style={styles.postCard}>
                    <div style={styles.postHeader}>
                      <div style={styles.postAvatar}>{mockAthlete.number}</div>
                      <div>
                        <div style={styles.postAuthor}>
                          {mockAthlete.name}
                          <span style={{ color: 'var(--osys-primary-light)' }}>✓</span>
                        </div>
                        <div style={styles.postTime}>{post.time}</div>
                      </div>
                    </div>
                    <div style={styles.postContent}>{post.content}</div>
                    {post.media && (
                      <div style={styles.postMedia}>{post.media}</div>
                    )}
                    <div style={styles.postActions}>
                      <button style={styles.postAction}>❤️ {post.likes}</button>
                      <button style={styles.postAction}>💬 {post.comments}</button>
                      <button style={styles.postAction}>🔄 {post.shares}</button>
                      <button style={styles.postAction}>🔖</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'highlights' && (
              <GlassCard>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem' }}>🎬 Video Highlights</h2>
                <div style={styles.highlightsGrid}>
                  {highlights.map(highlight => (
                    <div key={highlight.id} style={styles.highlightCard}>
                      <div style={styles.highlightThumbnail}>
                        <div style={styles.highlightPlayBtn}>▶</div>
                        <span style={styles.highlightDuration}>{highlight.duration}</span>
                      </div>
                      <div style={styles.highlightInfo}>
                        <div style={styles.highlightTitle}>{highlight.title}</div>
                        <div style={styles.highlightMeta}>{highlight.views} views</div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {activeTab === 'achievements' && (
              <GlassCard>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem' }}>🏆 Achievements & Awards</h2>
                {achievements.map((achievement, i) => (
                  <div key={i} style={styles.achievementItem}>
                    <div style={styles.achievementIcon}>{achievement.icon}</div>
                    <div>
                      <div style={styles.achievementTitle}>{achievement.title}</div>
                      <div style={styles.achievementDesc}>{achievement.description}</div>
                    </div>
                  </div>
                ))}
              </GlassCard>
            )}

            {activeTab === 'kudos' && (
              <GlassCard>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.5rem' }}>💫 Recent Kudos</h2>
                {kudosItems.map(kudos => (
                  <div key={kudos.id} style={styles.kudosItem}>
                    <div style={styles.kudosAvatar}>{kudos.initials}</div>
                    <div style={styles.kudosContent}>
                      <div style={styles.kudosHeader}>
                        <span style={styles.kudosName}>{kudos.from}</span>
                        <span style={styles.kudosTime}>{kudos.time}</span>
                      </div>
                      <div style={styles.kudosText}>{kudos.message}</div>
                    </div>
                  </div>
                ))}
              </GlassCard>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* NIL / Fundraising Card */}
            <div style={styles.nilBanner}>
              <h3 style={styles.nilTitle}>🎯 Support {mockAthlete.name.split(' ')[0]}'s Journey</h3>
              <p style={styles.nilDescription}>
                Help fund training equipment and camp fees
              </p>
              <ProgressBar value={68} max={100} label="$6,800 of $10,000" />
              <div style={{ ...styles.nilStats, marginTop: '1rem' }}>
                <div style={styles.nilStat}>
                  <div style={styles.nilStatValue}>127</div>
                  <div style={styles.nilStatLabel}>Supporters</div>
                </div>
                <div style={styles.nilStat}>
                  <div style={styles.nilStatValue}>$6,800</div>
                  <div style={styles.nilStatLabel}>Raised</div>
                </div>
              </div>
              <Button variant="primary" style={{ width: '100%', marginTop: '1rem', background: 'var(--osys-bg-primary)', color: 'white' }}>
                💝 Contribute
              </Button>
            </div>

            {/* Achievements Sidebar */}
            <GlassCard style={styles.sidebarCard}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>🏆 Top Achievements</h3>
              {achievements.slice(0, 3).map((achievement, i) => (
                <div key={i} style={{ ...styles.achievementItem, padding: '0.75rem' }}>
                  <div style={{ ...styles.achievementIcon, width: '36px', height: '36px', fontSize: '1rem' }}>
                    {achievement.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{achievement.title}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--osys-text-tertiary)' }}>{achievement.description}</div>
                  </div>
                </div>
              ))}
            </GlassCard>

            {/* Quick Stats */}
            <GlassCard style={styles.sidebarCard}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>📊 Quick Stats</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--osys-bg-primary)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--osys-primary-light)' }}>18</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--osys-text-tertiary)', textTransform: 'uppercase' }}>TDs</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--osys-bg-primary)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--osys-primary-light)' }}>67%</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--osys-text-tertiary)', textTransform: 'uppercase' }}>Comp</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--osys-bg-primary)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--osys-primary-light)' }}>1,847</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--osys-text-tertiary)', textTransform: 'uppercase' }}>Yards</div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--osys-bg-primary)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--osys-primary-light)' }}>142.3</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--osys-text-tertiary)', textTransform: 'uppercase' }}>QBR</div>
                </div>
              </div>
            </GlassCard>

            {/* Social Links */}
            <GlassCard>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>🔗 Connect</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--osys-bg-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>📷</div>
                <div style={{ width: '40px', height: '40px', background: 'var(--osys-bg-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🐦</div>
                <div style={{ width: '40px', height: '40px', background: 'var(--osys-bg-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>📹</div>
                <div style={{ width: '40px', height: '40px', background: 'var(--osys-bg-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🔗</div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* Mobile-responsive styles */}
      <style>{`
        @media (max-width: 1024px) {
          .content-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .profile-card {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          .profile-meta {
            justify-content: center !important;
          }
          .profile-actions {
            justify-content: center !important;
          }
          .stats-hero {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .highlights-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default OSYSAthleteProfile;
