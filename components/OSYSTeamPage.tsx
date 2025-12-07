import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge, ProgressBar } from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';
import { LiveGameBanner } from './ui/LiveGameBanner';
import { useDemoToast } from '../hooks/useOSYSData';

// Types
interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  classYear: string;
}

interface ScheduleGame {
  id: string;
  opponent: string;
  date: { day: number; month: string };
  time: string;
  location: string;
  result?: { type: 'win' | 'loss'; score: string };
  isUpcoming?: boolean;
}

interface Announcement {
  id: string;
  author: string;
  initials: string;
  content: string;
  time: string;
}

// Mock Data
const mockTeam = {
  name: 'Eastside Eagles',
  tagline: 'Soaring to Victory Since 1987',
  emoji: '🦅',
  sport: 'Football',
  level: 'Varsity',
  location: 'Atlanta, GA',
  division: 'Region 4-AAAA',
  playerCount: 24,
  record: '8-2',
  regionRank: '#3',
  pointsScored: 287,
  pointsAllowed: 124,
  winStreak: 5
};

const roster: Player[] = [
  { id: '1', name: 'Marcus Johnson', number: 12, position: 'QB', classYear: '2026' },
  { id: '2', name: 'DeShawn Williams', number: 24, position: 'RB', classYear: '2025' },
  { id: '3', name: 'Chris Thompson', number: 88, position: 'WR', classYear: '2026' },
  { id: '4', name: 'Tyler Smith', number: 7, position: 'WR', classYear: '2025' },
  { id: '5', name: 'Andre Davis', number: 55, position: 'LB', classYear: '2026' },
  { id: '6', name: 'Michael Brown', number: 75, position: 'OL', classYear: '2025' },
  { id: '7', name: 'James Wilson', number: 32, position: 'DB', classYear: '2026' },
  { id: '8', name: 'David Lee', number: 44, position: 'LB', classYear: '2027' },
];

const schedule: ScheduleGame[] = [
  { id: '1', opponent: 'vs. Panthers', date: { day: 13, month: 'DEC' }, time: '7:00 PM', location: 'Home', isUpcoming: true },
  { id: '2', opponent: '@ Tigers', date: { day: 6, month: 'DEC' }, time: '7:00 PM', location: 'Away', result: { type: 'win', score: '35-21' } },
  { id: '3', opponent: 'vs. Bears', date: { day: 29, month: 'NOV' }, time: '7:00 PM', location: 'Home', result: { type: 'win', score: '42-14' } },
  { id: '4', opponent: '@ Bulldogs', date: { day: 22, month: 'NOV' }, time: '7:00 PM', location: 'Away', result: { type: 'win', score: '28-24' } },
  { id: '5', opponent: 'vs. Lions', date: { day: 15, month: 'NOV' }, time: '7:00 PM', location: 'Home', result: { type: 'loss', score: '21-28' } },
];

const announcements: Announcement[] = [
  { id: '1', author: 'Coach Williams', initials: 'CW', content: 'Great practice today team! Remember - film session tomorrow at 3pm. Playoff push starts now! 🏈', time: '2h ago' },
  { id: '2', author: 'Team Admin', initials: 'TA', content: 'Spirit wear pickup is Saturday 10am-2pm at the field house. Don\'t forget your order confirmation!', time: '1d ago' },
  { id: '3', author: 'Coach Williams', initials: 'CW', content: 'Congrats to Marcus Johnson on being named Player of the Week! Well deserved! 🏆', time: '3d ago' },
];

const sponsors = [
  { name: 'Local Bank', emoji: '🏦' },
  { name: 'Sports Gear', emoji: '🏪' },
  { name: 'Pizza Place', emoji: '🍕' },
  { name: 'Auto Shop', emoji: '🚗' },
  { name: 'Insurance Co', emoji: '🛡️' },
  { name: 'Medical Center', emoji: '🏥' },
];

const galleryItems = ['🏈', '🎬', '📸', '🏆', '👥', '🎉', '⭐', '🔥', '💪'];

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
    height: '320px',
    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '60px',
    overflow: 'hidden'
  },
  heroPattern: {
    position: 'absolute' as const,
    inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='50' font-size='60' opacity='0.05'%3E🦅%3C/text%3E%3C/svg%3E")`,
    backgroundSize: '100px'
  },
  heroGradient: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '200px',
    background: 'linear-gradient(to top, var(--osys-bg-primary) 0%, transparent 100%)'
  },
  teamLogo: {
    width: '160px',
    height: '160px',
    background: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '5rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    position: 'relative' as const,
    zIndex: 1
  },
  teamHeader: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem',
    position: 'relative' as const,
    marginTop: '-60px',
    textAlign: 'center' as const,
    zIndex: 10
  },
  teamName: {
    fontSize: '3rem',
    fontWeight: 900,
    marginBottom: '0.5rem'
  },
  teamTagline: {
    fontSize: '1.125rem',
    color: 'var(--osys-text-secondary)',
    marginBottom: '1.5rem'
  },
  teamMeta: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    flexWrap: 'wrap' as const,
    marginBottom: '1.5rem'
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--osys-text-secondary)'
  },
  teamActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.75rem',
    marginBottom: '2rem',
    flexWrap: 'wrap' as const
  },
  statsBanner: {
    background: 'var(--osys-glass-bg)',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    padding: '1.5rem 0',
    position: 'relative' as const,
    zIndex: 10
  },
  statsBannerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem',
    display: 'flex',
    justifyContent: 'space-around',
    flexWrap: 'wrap' as const,
    gap: '1rem'
  },
  statBannerItem: {
    textAlign: 'center' as const,
    minWidth: '120px'
  },
  statBannerValue: {
    fontSize: '2rem',
    fontWeight: 800,
    background: 'var(--osys-gradient-gold)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  statBannerLabel: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '2rem',
    overflowX: 'auto' as const
  },
  tab: {
    padding: '1rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--osys-text-tertiary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'color 0.2s'
  },
  tabActive: {
    color: 'white',
    borderBottom: '2px solid var(--osys-primary)'
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    position: 'relative' as const,
    zIndex: 10
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1.5rem'
  },
  rosterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '1rem'
  },
  rosterCard: {
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    padding: '1rem',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.3s',
    textDecoration: 'none',
    color: 'white',
    border: '1px solid transparent'
  },
  rosterAvatar: {
    width: '64px',
    height: '64px',
    background: 'var(--osys-gradient-gold)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 800,
    margin: '0 auto 0.75rem',
    color: 'var(--osys-bg-primary)'
  },
  rosterName: {
    fontWeight: 600,
    fontSize: '0.875rem',
    marginBottom: '0.25rem'
  },
  rosterPosition: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)'
  },
  scheduleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    marginBottom: '0.75rem',
    transition: 'all 0.2s'
  },
  scheduleDate: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  scheduleDateDay: {
    fontSize: '1.25rem',
    fontWeight: 700
  },
  scheduleDateMonth: {
    fontSize: '0.625rem',
    textTransform: 'uppercase' as const,
    opacity: 0.8
  },
  scheduleInfo: {
    flex: 1
  },
  scheduleOpponent: {
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  scheduleMeta: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)'
  },
  scheduleResult: {
    padding: '0.375rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 700
  },
  announcementItem: {
    padding: '1rem',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    borderLeft: '3px solid var(--osys-secondary)',
    marginBottom: '1rem'
  },
  announcementHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  },
  announcementAuthor: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  announcementAvatar: {
    width: '28px',
    height: '28px',
    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.625rem',
    fontWeight: 600
  },
  announcementName: {
    fontSize: '0.8125rem',
    fontWeight: 600
  },
  announcementTime: {
    fontSize: '0.6875rem',
    color: 'var(--osys-text-tertiary)'
  },
  announcementText: {
    fontSize: '0.875rem',
    color: 'var(--osys-text-secondary)',
    lineHeight: 1.5
  },
  fundraiserCard: {
    background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
    borderRadius: '20px',
    padding: '1.5rem',
    marginBottom: '1.5rem'
  },
  fundraiserHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem'
  },
  fundraiserBadge: {
    padding: '0.25rem 0.75rem',
    background: 'var(--osys-secondary)',
    color: 'var(--osys-bg-primary)',
    borderRadius: '20px',
    fontSize: '0.6875rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const
  },
  fundraiserTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    marginBottom: '0.25rem'
  },
  fundraiserDesc: {
    fontSize: '0.875rem',
    opacity: 0.8,
    marginBottom: '1rem'
  },
  sponsorsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem'
  },
  sponsorCard: {
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    padding: '1.5rem 1rem',
    textAlign: 'center' as const
  },
  sponsorLogo: {
    fontSize: '2rem',
    marginBottom: '0.5rem'
  },
  sponsorName: {
    fontSize: '0.75rem',
    color: 'var(--osys-text-tertiary)'
  },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem'
  },
  galleryItem: {
    aspectRatio: '1',
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  teamStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem'
  },
  teamStatCard: {
    background: 'var(--osys-bg-primary)',
    borderRadius: '12px',
    padding: '1rem',
    textAlign: 'center' as const
  },
  teamStatValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--osys-primary-light)'
  },
  teamStatLabel: {
    fontSize: '0.6875rem',
    color: 'var(--osys-text-tertiary)',
    textTransform: 'uppercase' as const
  }
};

// Component
export function OSYSTeamPage() {
  const [activeTab, setActiveTab] = useState('roster');
  const { showToast, ToastComponent } = useDemoToast();

  const tabs = [
    { id: 'roster', label: '👥 Roster' },
    { id: 'schedule', label: '📅 Schedule' },
    { id: 'announcements', label: '📢 Announcements' },
    { id: 'gallery', label: '📸 Gallery' },
    { id: 'sponsors', label: '🤝 Sponsors' }
  ];

  const getResultStyle = (result?: { type: 'win' | 'loss' }) => {
    if (!result) return { background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' };
    return result.type === 'win' 
      ? { background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }
      : { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
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
        <div style={styles.navRight}>
          <Button variant="ghost" onClick={() => showToast('No new notifications', 'info')}>🔔</Button>
          <Button variant="primary" onClick={() => showToast('Sign in coming soon!', 'info')}>Sign In</Button>
        </div>
      </nav>

      {/* Live Game Banner */}
      <LiveGameBanner 
        homeTeam={{
          name: "Wildcats",
          abbreviation: "WLD",
          score: 21,
          primaryColor: "#667eea"
        }}
        awayTeam={{
          name: "Tigers",
          abbreviation: "TGR",
          score: 14,
          primaryColor: "#f59e0b"
        }}
        period="3rd Quarter"
        timeRemaining="8:42"
        onWatch={() => showToast('Opening live stream...', 'success')}
      />

      {/* Hero Banner */}
      <div style={styles.heroBanner}>
        <div style={styles.heroPattern} />
        <div style={styles.heroGradient} />
        <div style={styles.teamLogo}>{mockTeam.emoji}</div>
      </div>

      {/* Team Header */}
      <div style={styles.teamHeader}>
        <h1 style={styles.teamName}>{mockTeam.name}</h1>
        <p style={styles.teamTagline}>{mockTeam.tagline}</p>
        <div style={styles.teamMeta}>
          <span style={styles.metaItem}>📍 {mockTeam.location}</span>
          <span style={styles.metaItem}>🏈 {mockTeam.sport} • {mockTeam.level}</span>
          <span style={styles.metaItem}>🏆 {mockTeam.division}</span>
          <span style={styles.metaItem}>👥 {mockTeam.playerCount} Players</span>
        </div>
        <div style={styles.teamActions}>
          <Button variant="gold" onClick={() => showToast('Ticket purchase coming soon!', 'info')}>🎟️ Buy Tickets</Button>
          <Button variant="primary" onClick={() => showToast('Team join request sent!', 'success')}>👥 Join Team</Button>
          <Button variant="ghost" onClick={() => showToast('Link copied to clipboard!', 'success')}>🔗 Share</Button>
        </div>
      </div>

      {/* Stats Banner */}
      <div style={styles.statsBanner}>
        <div style={styles.statsBannerContent}>
          <div style={styles.statBannerItem}>
            <div style={styles.statBannerValue}>{mockTeam.record}</div>
            <div style={styles.statBannerLabel}>Record</div>
          </div>
          <div style={styles.statBannerItem}>
            <div style={styles.statBannerValue}>{mockTeam.regionRank}</div>
            <div style={styles.statBannerLabel}>Region Rank</div>
          </div>
          <div style={styles.statBannerItem}>
            <div style={styles.statBannerValue}>{mockTeam.pointsScored}</div>
            <div style={styles.statBannerLabel}>Points Scored</div>
          </div>
          <div style={styles.statBannerItem}>
            <div style={styles.statBannerValue}>{mockTeam.pointsAllowed}</div>
            <div style={styles.statBannerLabel}>Points Allowed</div>
          </div>
          <div style={styles.statBannerItem}>
            <div style={styles.statBannerValue}>{mockTeam.winStreak}</div>
            <div style={styles.statBannerLabel}>Win Streak</div>
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
            </button>
          ))}
        </div>

        <div style={styles.contentGrid}>
          {/* Main Column */}
          <div>
            {activeTab === 'roster' && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>👥 Team Roster</h2>
                  <a href="#" style={{ fontSize: '0.75rem', color: 'var(--osys-primary-light)', textDecoration: 'none' }}>View Full Roster →</a>
                </div>
                <div style={styles.rosterGrid}>
                  {roster.map(player => (
                    <a key={player.id} href={`/athlete/${player.name.toLowerCase().replace(' ', '-')}`} style={styles.rosterCard}>
                      <div style={styles.rosterAvatar}>{player.number}</div>
                      <div style={styles.rosterName}>{player.name}</div>
                      <div style={styles.rosterPosition}>{player.position} • {player.classYear}</div>
                    </a>
                  ))}
                </div>
              </GlassCard>
            )}

            {activeTab === 'schedule' && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>📅 Season Schedule</h2>
                  <a href="#" style={{ fontSize: '0.75rem', color: 'var(--osys-primary-light)', textDecoration: 'none' }}>View Full Schedule →</a>
                </div>
                {schedule.map(game => (
                  <div key={game.id} style={styles.scheduleItem}>
                    <div style={styles.scheduleDate}>
                      <div style={styles.scheduleDateDay}>{game.date.day}</div>
                      <div style={styles.scheduleDateMonth}>{game.date.month}</div>
                    </div>
                    <div style={styles.scheduleInfo}>
                      <div style={styles.scheduleOpponent}>{game.opponent}</div>
                      <div style={styles.scheduleMeta}>⏰ {game.time} • 📍 {game.location}</div>
                    </div>
                    <div style={{
                      ...styles.scheduleResult,
                      ...getResultStyle(game.result)
                    }}>
                      {game.result ? game.result.score : 'Upcoming'}
                    </div>
                  </div>
                ))}
              </GlassCard>
            )}

            {activeTab === 'announcements' && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>📢 Team Announcements</h2>
                </div>
                {announcements.map(announcement => (
                  <div key={announcement.id} style={styles.announcementItem}>
                    <div style={styles.announcementHeader}>
                      <div style={styles.announcementAuthor}>
                        <div style={styles.announcementAvatar}>{announcement.initials}</div>
                        <span style={styles.announcementName}>{announcement.author}</span>
                      </div>
                      <span style={styles.announcementTime}>{announcement.time}</span>
                    </div>
                    <p style={styles.announcementText}>{announcement.content}</p>
                  </div>
                ))}
              </GlassCard>
            )}

            {activeTab === 'gallery' && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>📸 Photo Gallery</h2>
                  <a href="#" style={{ fontSize: '0.75rem', color: 'var(--osys-primary-light)', textDecoration: 'none' }}>View All →</a>
                </div>
                <div style={styles.galleryGrid}>
                  {galleryItems.map((item, i) => (
                    <div 
                      key={i} 
                      style={{
                        ...styles.galleryItem,
                        ...(i === 0 ? { gridColumn: 'span 2', gridRow: 'span 2' } : {})
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {activeTab === 'sponsors' && (
              <GlassCard>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>🤝 Team Sponsors</h2>
                  <a href="#" style={{ fontSize: '0.75rem', color: 'var(--osys-primary-light)', textDecoration: 'none' }}>Become a Sponsor →</a>
                </div>
                <div style={styles.sponsorsGrid}>
                  {sponsors.map((sponsor, i) => (
                    <div key={i} style={styles.sponsorCard}>
                      <div style={styles.sponsorLogo}>{sponsor.emoji}</div>
                      <div style={styles.sponsorName}>{sponsor.name}</div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Team Fundraiser */}
            <div style={styles.fundraiserCard}>
              <div style={styles.fundraiserHeader}>
                <div>
                  <span style={styles.fundraiserBadge}>Active</span>
                </div>
              </div>
              <h3 style={styles.fundraiserTitle}>🎯 Playoff Equipment Fund</h3>
              <p style={styles.fundraiserDesc}>
                Help us get new equipment for the playoff run!
              </p>
              <ProgressBar value={68} max={100} label="$13,600 of $20,000" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700 }}>$13,600 raised</span>
                <span style={{ opacity: 0.7 }}>84 donors</span>
              </div>
              <Button variant="gold" style={{ width: '100%' }} onClick={() => showToast('Donations coming soon!', 'info')}>
                💝 Support the Team
              </Button>
            </div>

            {/* Team Stats */}
            <GlassCard style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>📊 Team Stats</h3>
              <div style={styles.teamStatsGrid}>
                <div style={styles.teamStatCard}>
                  <div style={styles.teamStatValue}>287</div>
                  <div style={styles.teamStatLabel}>Points</div>
                </div>
                <div style={styles.teamStatCard}>
                  <div style={styles.teamStatValue}>124</div>
                  <div style={styles.teamStatLabel}>Allowed</div>
                </div>
                <div style={styles.teamStatCard}>
                  <div style={styles.teamStatValue}>1,847</div>
                  <div style={styles.teamStatLabel}>Pass Yds</div>
                </div>
                <div style={styles.teamStatCard}>
                  <div style={styles.teamStatValue}>1,234</div>
                  <div style={styles.teamStatLabel}>Rush Yds</div>
                </div>
              </div>
            </GlassCard>

            {/* Upcoming Game */}
            <GlassCard style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>🏈 Next Game</h3>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--osys-bg-primary)', borderRadius: '12px' }}>
                <Badge variant="live">🔴 UPCOMING</Badge>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '1rem 0' }}>vs. Panthers</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--osys-text-secondary)' }}>
                  📅 Friday, Dec 13
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--osys-text-secondary)' }}>
                  ⏰ 7:00 PM • 📍 Home
                </div>
                <Button variant="gold" style={{ width: '100%', marginTop: '1rem' }} onClick={() => showToast('Tickets coming soon!', 'info')}>
                  🎟️ Get Tickets
                </Button>
              </div>
            </GlassCard>

            {/* Quick Links */}
            <GlassCard>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>🔗 Quick Links</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Live games coming soon!', 'info')}>📹 Watch Live Games</Button>
                <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Highlights coming soon!', 'info')}>🎬 Highlight Reels</Button>
                <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Full stats coming soon!', 'info')}>📊 Full Stats</Button>
                <Button variant="ghost" style={{ justifyContent: 'flex-start' }} onClick={() => showToast('Playbook coming soon!', 'info')}>📝 Team Playbook</Button>
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
          .team-name {
            font-size: 2rem !important;
          }
          .roster-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .sponsors-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      {/* Demo Navigation */}
      <DemoNavigation currentPage="team-demo" />
      
      {/* Toast Notifications */}
      {ToastComponent}
    </div>
  );
}

export default OSYSTeamPage;
