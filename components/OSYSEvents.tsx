import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge, ProgressBar } from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';

// Types
interface Event {
  id: string;
  title: string;
  type: 'game' | 'practice' | 'tournament' | 'fundraiser' | 'meeting' | 'camp';
  date: string;
  time: string;
  location: string;
  opponent?: string;
  opponentEmoji?: string;
  homeAway?: 'home' | 'away' | 'neutral';
  ticketsAvailable?: number;
  ticketPrice?: number;
  description?: string;
  isFeatured?: boolean;
}

interface CalendarDay {
  date: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: Event[];
}

// Mock Data
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Season Opener',
    type: 'game',
    date: 'Fri, Jan 10',
    time: '7:00 PM',
    location: 'Memorial Stadium',
    opponent: 'Valley Tigers',
    opponentEmoji: '🐯',
    homeAway: 'home',
    ticketsAvailable: 245,
    ticketPrice: 15,
    isFeatured: true
  },
  {
    id: '2',
    title: 'Team Practice',
    type: 'practice',
    date: 'Mon, Jan 13',
    time: '4:00 PM',
    location: 'Practice Field A',
    description: 'Full pads, focus on running game'
  },
  {
    id: '3',
    title: 'Regional Tournament',
    type: 'tournament',
    date: 'Sat, Jan 18',
    time: '9:00 AM',
    location: 'State Sports Complex',
    description: 'First round of regional playoffs',
    isFeatured: true
  },
  {
    id: '4',
    title: 'Away Game @ Hawks',
    type: 'game',
    date: 'Fri, Jan 24',
    time: '7:30 PM',
    location: 'Hawk Arena',
    opponent: 'Hillside Hawks',
    opponentEmoji: '🦅',
    homeAway: 'away',
    ticketPrice: 12
  },
  {
    id: '5',
    title: 'Team Fundraiser Dinner',
    type: 'fundraiser',
    date: 'Sat, Jan 25',
    time: '6:00 PM',
    location: 'Community Center',
    ticketsAvailable: 80,
    ticketPrice: 50,
    description: 'Annual fundraiser gala with silent auction'
  },
  {
    id: '6',
    title: 'Parent Meeting',
    type: 'meeting',
    date: 'Tue, Jan 28',
    time: '6:30 PM',
    location: 'School Auditorium',
    description: 'Season overview and travel arrangements'
  },
  {
    id: '7',
    title: 'Skills Camp',
    type: 'camp',
    date: 'Sat, Feb 1',
    time: '8:00 AM',
    location: 'Training Facility',
    ticketsAvailable: 25,
    ticketPrice: 75,
    description: 'Youth skills development camp'
  }
];

const eventTypeConfig = {
  game: { icon: '🏈', color: '#667eea', label: 'Game' },
  practice: { icon: '🏃', color: '#10b981', label: 'Practice' },
  tournament: { icon: '🏆', color: '#f59e0b', label: 'Tournament' },
  fundraiser: { icon: '💰', color: '#eab308', label: 'Fundraiser' },
  meeting: { icon: '📋', color: '#8b5cf6', label: 'Meeting' },
  camp: { icon: '⭐', color: '#06b6d4', label: 'Camp' }
};

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
  header: {
    padding: '2rem 2rem 0',
    textAlign: 'center' as const,
    position: 'relative',
    zIndex: 1
  },
  headerTitle: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
    background: 'var(--osys-gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  headerSubtitle: {
    fontSize: '1.125rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '2rem'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '2rem',
    padding: '2rem',
    maxWidth: '1600px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1
  },
  eventsSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  filterTabs: {
    display: 'flex',
    gap: '0.5rem',
    background: 'rgba(255,255,255,0.05)',
    padding: '0.25rem',
    borderRadius: '12px'
  },
  filterTab: {
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  filterTabActive: {
    background: 'var(--osys-gradient-primary)',
    color: 'white'
  },
  featuredEvent: {
    background: 'linear-gradient(135deg, rgba(102,126,234,0.2) 0%, rgba(118,75,162,0.1) 100%)',
    borderRadius: '20px',
    padding: '2rem',
    border: '1px solid rgba(102,126,234,0.3)',
    position: 'relative' as const,
    overflow: 'hidden'
  },
  featuredBadge: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    background: 'var(--osys-gradient-gold)',
    color: '#1a1a2e',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 600
  },
  featuredContent: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'center'
  },
  featuredIcon: {
    width: '100px',
    height: '100px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    flexShrink: 0
  },
  featuredInfo: {
    flex: 1
  },
  featuredTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem'
  },
  featuredMeta: {
    display: 'flex',
    gap: '1.5rem',
    marginBottom: '1rem',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.9375rem'
  },
  featuredMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  featuredVs: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem'
  },
  vsTeam: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '12px'
  },
  featuredActions: {
    display: 'flex',
    gap: '0.75rem'
  },
  eventCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    transition: 'all 0.3s',
    cursor: 'pointer'
  },
  eventIcon: {
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    flexShrink: 0
  },
  eventContent: {
    flex: 1,
    minWidth: 0
  },
  eventTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  eventMeta: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '0.5rem'
  },
  eventDescription: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.4
  },
  eventActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '0.5rem'
  },
  ticketInfo: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'right' as const
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem'
  },
  calendar: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '20px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  },
  calendarMonth: {
    fontSize: '1.125rem',
    fontWeight: 600
  },
  calendarNav: {
    display: 'flex',
    gap: '0.5rem'
  },
  calendarNavBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  calendarDays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.25rem',
    marginBottom: '0.5rem'
  },
  calendarDayLabel: {
    textAlign: 'center' as const,
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.4)',
    padding: '0.5rem 0'
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.25rem'
  },
  calendarDay: {
    aspectRatio: '1',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative' as const
  },
  calendarDayOther: {
    color: 'rgba(255,255,255,0.2)'
  },
  calendarDayToday: {
    background: 'var(--osys-gradient-primary)',
    fontWeight: 600
  },
  calendarDayEvent: {
    background: 'rgba(102,126,234,0.2)'
  },
  eventDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: '#667eea',
    position: 'absolute' as const,
    bottom: '4px'
  },
  upcomingCard: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    marginBottom: '0.75rem'
  },
  upcomingDate: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    width: '50px',
    height: '50px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '10px'
  },
  upcomingDateDay: {
    fontSize: '1.25rem',
    fontWeight: 700,
    lineHeight: 1
  },
  upcomingDateMonth: {
    fontSize: '0.625rem',
    textTransform: 'uppercase' as const,
    opacity: 0.8
  },
  upcomingInfo: {
    flex: 1,
    minWidth: 0
  },
  upcomingTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.125rem',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  upcomingMeta: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)'
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem'
  },
  quickAction: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  quickActionIcon: {
    fontSize: '1.5rem'
  },
  quickActionLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)'
  }
};

export const OSYSEvents: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [currentMonth] = useState('January 2025');

  const filters = [
    { id: 'all', label: 'All Events' },
    { id: 'game', label: 'Games' },
    { id: 'practice', label: 'Practice' },
    { id: 'fundraiser', label: 'Fundraisers' }
  ];

  const filteredEvents = activeFilter === 'all' 
    ? mockEvents 
    : mockEvents.filter(e => e.type === activeFilter);

  const featuredEvent = mockEvents.find(e => e.isFeatured && e.type === 'game');

  const calendarDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  // Mock calendar data
  const calendarData = Array.from({ length: 35 }, (_, i) => ({
    date: i < 4 ? 28 + i : i - 3,
    isCurrentMonth: i >= 4,
    isToday: i === 13,
    hasEvent: [7, 13, 17, 21, 24, 27, 31].includes(i)
  }));

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
          <Button variant="gold">+ Create Event</Button>
          <Button variant="primary">Sign In</Button>
        </div>
      </nav>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>📅 Team Events & Schedule</h1>
        <p style={styles.headerSubtitle}>
          Never miss a game, practice, or team event
        </p>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Events List */}
        <div style={styles.eventsSection}>
          {/* Featured Event */}
          {featuredEvent && (
            <div style={styles.featuredEvent}>
              <span style={styles.featuredBadge}>⭐ Featured</span>
              <div style={styles.featuredContent}>
                <div style={styles.featuredIcon}>🏈</div>
                <div style={styles.featuredInfo}>
                  <div style={styles.featuredTitle}>{featuredEvent.title}</div>
                  <div style={styles.featuredMeta}>
                    <span style={styles.featuredMetaItem}>📅 {featuredEvent.date}</span>
                    <span style={styles.featuredMetaItem}>🕐 {featuredEvent.time}</span>
                    <span style={styles.featuredMetaItem}>📍 {featuredEvent.location}</span>
                  </div>
                  {featuredEvent.opponent && (
                    <div style={styles.featuredVs}>
                      <div style={styles.vsTeam}>
                        <span>🐾</span>
                        <span>Wildcats</span>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>vs</span>
                      <div style={styles.vsTeam}>
                        <span>{featuredEvent.opponentEmoji}</span>
                        <span>{featuredEvent.opponent}</span>
                      </div>
                      <Badge variant="success">{featuredEvent.homeAway?.toUpperCase()}</Badge>
                    </div>
                  )}
                  <div style={styles.featuredActions}>
                    <Button variant="gold">🎟️ Buy Tickets (${featuredEvent.ticketPrice})</Button>
                    <Button variant="primary">📺 Watch Live</Button>
                    <Button variant="ghost">🔗 Share</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>📆 Upcoming Events</h2>
            <div style={styles.filterTabs}>
              {filters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  style={{
                    ...styles.filterTab,
                    ...(activeFilter === filter.id ? styles.filterTabActive : {})
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Events Grid */}
          {filteredEvents.map(event => {
            const config = eventTypeConfig[event.type];
            return (
              <div key={event.id} style={styles.eventCard}>
                <div style={{ ...styles.eventIcon, background: `${config.color}22` }}>
                  {config.icon}
                </div>
                <div style={styles.eventContent}>
                  <div style={styles.eventTitle}>
                    {event.title}
                    <Badge variant={event.type === 'game' ? 'primary' : 'default'}>
                      {config.label}
                    </Badge>
                    {event.homeAway && (
                      <Badge variant={event.homeAway === 'home' ? 'success' : 'warning'}>
                        {event.homeAway.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <div style={styles.eventMeta}>
                    <span>📅 {event.date}</span>
                    <span>🕐 {event.time}</span>
                    <span>📍 {event.location}</span>
                  </div>
                  {event.opponent && (
                    <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      vs {event.opponentEmoji} <strong>{event.opponent}</strong>
                    </div>
                  )}
                  {event.description && (
                    <div style={styles.eventDescription}>{event.description}</div>
                  )}
                </div>
                <div style={styles.eventActions}>
                  {event.ticketPrice && (
                    <Button variant="primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                      🎟️ ${event.ticketPrice}
                    </Button>
                  )}
                  {event.ticketsAvailable && (
                    <div style={styles.ticketInfo}>{event.ticketsAvailable} left</div>
                  )}
                  <Button variant="ghost" style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                    Details →
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          {/* Calendar */}
          <div style={styles.calendar}>
            <div style={styles.calendarHeader}>
              <span style={styles.calendarMonth}>{currentMonth}</span>
              <div style={styles.calendarNav}>
                <button style={styles.calendarNavBtn}>←</button>
                <button style={styles.calendarNavBtn}>→</button>
              </div>
            </div>
            
            <div style={styles.calendarDays}>
              {calendarDays.map((day, i) => (
                <div key={i} style={styles.calendarDayLabel}>{day}</div>
              ))}
            </div>
            
            <div style={styles.calendarGrid}>
              {calendarData.map((day, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.calendarDay,
                    ...(!day.isCurrentMonth ? styles.calendarDayOther : {}),
                    ...(day.isToday ? styles.calendarDayToday : {}),
                    ...(day.hasEvent && !day.isToday ? styles.calendarDayEvent : {})
                  }}
                >
                  {day.date}
                  {day.hasEvent && <div style={styles.eventDot} />}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <GlassCard>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>⚡ Quick Actions</h3>
            <div style={styles.quickActions}>
              <div style={styles.quickAction}>
                <span style={styles.quickActionIcon}>➕</span>
                <span style={styles.quickActionLabel}>Add Event</span>
              </div>
              <div style={styles.quickAction}>
                <span style={styles.quickActionIcon}>📤</span>
                <span style={styles.quickActionLabel}>Export</span>
              </div>
              <div style={styles.quickAction}>
                <span style={styles.quickActionIcon}>🔔</span>
                <span style={styles.quickActionLabel}>Reminders</span>
              </div>
              <div style={styles.quickAction}>
                <span style={styles.quickActionIcon}>🔗</span>
                <span style={styles.quickActionLabel}>Share</span>
              </div>
            </div>
          </GlassCard>

          {/* Upcoming This Week */}
          <GlassCard>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>📌 This Week</h3>
            {mockEvents.slice(0, 4).map(event => {
              const config = eventTypeConfig[event.type];
              return (
                <div key={event.id} style={styles.upcomingCard}>
                  <div style={styles.upcomingDate}>
                    <span style={styles.upcomingDateDay}>
                      {event.date.split(',')[1]?.trim().split(' ')[1] || '10'}
                    </span>
                    <span style={styles.upcomingDateMonth}>
                      {event.date.split(',')[1]?.trim().split(' ')[0]?.substring(0, 3) || 'JAN'}
                    </span>
                  </div>
                  <div style={styles.upcomingInfo}>
                    <div style={styles.upcomingTitle}>{event.title}</div>
                    <div style={styles.upcomingMeta}>
                      {config.icon} {event.time} • {event.location}
                    </div>
                  </div>
                </div>
              );
            })}
          </GlassCard>

          {/* Season Stats */}
          <GlassCard>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>📊 Season Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(34,197,94,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>8-2</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Record</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(102,126,234,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#667eea' }}>12</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Games Left</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(234,179,8,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#eab308' }}>3</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Fundraisers</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(139,92,246,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>#3</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Region Rank</div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <DemoNavigation />
    </div>
  );
};

export default OSYSEvents;
