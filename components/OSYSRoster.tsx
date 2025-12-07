import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge } from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';
import { useDemoToast } from '../hooks/useOSYSData';

// Types
interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  year: string;
  height: string;
  weight: number;
  gpa: number;
  status: 'active' | 'injured' | 'suspended' | 'redshirt';
  isCaptain?: boolean;
  isStarter?: boolean;
  stats: {
    gamesPlayed: number;
    avgPoints?: number;
    avgYards?: number;
  };
  avatar: string;
  hometown: string;
}

// Mock Data
const mockPlayers: Player[] = [
  {
    id: '1',
    name: 'Marcus Johnson',
    number: 7,
    position: 'QB',
    year: 'Senior',
    height: "6'2\"",
    weight: 195,
    gpa: 3.6,
    status: 'active',
    isCaptain: true,
    isStarter: true,
    stats: { gamesPlayed: 10, avgYards: 245 },
    avatar: '🏃',
    hometown: 'Austin, TX'
  },
  {
    id: '2',
    name: 'Tyler Chen',
    number: 23,
    position: 'RB',
    year: 'Junior',
    height: "5'10\"",
    weight: 185,
    gpa: 3.4,
    status: 'active',
    isStarter: true,
    stats: { gamesPlayed: 10, avgYards: 95 },
    avatar: '🏃',
    hometown: 'Dallas, TX'
  },
  {
    id: '3',
    name: 'Darius Williams',
    number: 88,
    position: 'WR',
    year: 'Senior',
    height: "6'1\"",
    weight: 175,
    gpa: 3.2,
    status: 'active',
    isCaptain: true,
    isStarter: true,
    stats: { gamesPlayed: 10, avgYards: 78 },
    avatar: '🏃',
    hometown: 'Houston, TX'
  },
  {
    id: '4',
    name: 'Jake Martinez',
    number: 55,
    position: 'OL',
    year: 'Senior',
    height: "6'4\"",
    weight: 285,
    gpa: 3.0,
    status: 'active',
    isStarter: true,
    stats: { gamesPlayed: 10 },
    avatar: '🏃',
    hometown: 'San Antonio, TX'
  },
  {
    id: '5',
    name: 'Chris Thompson',
    number: 99,
    position: 'DL',
    year: 'Junior',
    height: "6'3\"",
    weight: 265,
    gpa: 3.3,
    status: 'active',
    isStarter: true,
    stats: { gamesPlayed: 10 },
    avatar: '🏃',
    hometown: 'Fort Worth, TX'
  },
  {
    id: '6',
    name: 'Aiden Smith',
    number: 15,
    position: 'WR',
    year: 'Sophomore',
    height: "5'11\"",
    weight: 170,
    gpa: 3.8,
    status: 'active',
    stats: { gamesPlayed: 8 },
    avatar: '🏃',
    hometown: 'Plano, TX'
  },
  {
    id: '7',
    name: 'Jordan Lee',
    number: 44,
    position: 'LB',
    year: 'Junior',
    height: "6'1\"",
    weight: 225,
    gpa: 2.9,
    status: 'injured',
    stats: { gamesPlayed: 6 },
    avatar: '🏃',
    hometown: 'Irving, TX'
  },
  {
    id: '8',
    name: 'Brandon Davis',
    number: 21,
    position: 'CB',
    year: 'Senior',
    height: "5'11\"",
    weight: 175,
    gpa: 3.1,
    status: 'active',
    isStarter: true,
    stats: { gamesPlayed: 10 },
    avatar: '🏃',
    hometown: 'Arlington, TX'
  },
  {
    id: '9',
    name: 'Kevin Wilson',
    number: 32,
    position: 'S',
    year: 'Sophomore',
    height: "6'0\"",
    weight: 190,
    gpa: 3.5,
    status: 'active',
    stats: { gamesPlayed: 9 },
    avatar: '🏃',
    hometown: 'Garland, TX'
  },
  {
    id: '10',
    name: 'Ryan Garcia',
    number: 12,
    position: 'QB',
    year: 'Freshman',
    height: "6'1\"",
    weight: 185,
    gpa: 3.7,
    status: 'redshirt',
    stats: { gamesPlayed: 0 },
    avatar: '🏃',
    hometown: 'Frisco, TX'
  }
];

const positionGroups = [
  { id: 'all', name: 'All Players' },
  { id: 'offense', name: 'Offense', positions: ['QB', 'RB', 'WR', 'TE', 'OL'] },
  { id: 'defense', name: 'Defense', positions: ['DL', 'LB', 'CB', 'S'] },
  { id: 'special', name: 'Special Teams', positions: ['K', 'P', 'LS'] }
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
  header: {
    padding: '1rem 2rem 2rem',
    position: 'relative',
    zIndex: 1
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem'
  },
  headerTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
    background: 'var(--osys-gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  headerSubtitle: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.6)'
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem'
  },
  statsRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem'
  },
  statCard: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center' as const
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
    marginBottom: '0.25rem'
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)'
  },
  filters: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    flexWrap: 'wrap' as const
  },
  filterTabs: {
    display: 'flex',
    gap: '0.25rem',
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
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '0.875rem',
    outline: 'none',
    width: '200px'
  },
  content: {
    padding: '0 2rem 4rem',
    position: 'relative',
    zIndex: 1
  },
  rosterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1rem'
  },
  playerCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  playerHeader: {
    display: 'flex',
    gap: '1rem',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, rgba(102,126,234,0.2) 0%, rgba(118,75,162,0.1) 100%)'
  },
  playerNumber: {
    width: '60px',
    height: '60px',
    borderRadius: '16px',
    background: 'var(--osys-gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    flexShrink: 0
  },
  playerInfo: {
    flex: 1,
    minWidth: 0
  },
  playerName: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  playerPosition: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  playerBadges: {
    display: 'flex',
    gap: '0.375rem',
    marginTop: '0.5rem'
  },
  playerBody: {
    padding: '1rem 1.25rem'
  },
  playerStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  playerStat: {
    textAlign: 'center' as const
  },
  playerStatValue: {
    fontSize: '1rem',
    fontWeight: 600
  },
  playerStatLabel: {
    fontSize: '0.625rem',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  playerFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.75rem',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  playerHometown: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem'
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'active':
      return { background: 'rgba(34,197,94,0.2)', color: '#22c55e' };
    case 'injured':
      return { background: 'rgba(239,68,68,0.2)', color: '#ef4444' };
    case 'suspended':
      return { background: 'rgba(234,179,8,0.2)', color: '#eab308' };
    case 'redshirt':
      return { background: 'rgba(139,92,246,0.2)', color: '#8b5cf6' };
    default:
      return { background: 'rgba(255,255,255,0.1)', color: 'white' };
  }
};

export const OSYSRoster: React.FC = () => {
  const [activeGroup, setActiveGroup] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { showToast, ToastComponent } = useDemoToast();

  const filteredPlayers = mockPlayers.filter(player => {
    // Search filter
    if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Position group filter
    if (activeGroup !== 'all') {
      const group = positionGroups.find(g => g.id === activeGroup);
      if (group?.positions && !group.positions.includes(player.position)) {
        return false;
      }
    }
    return true;
  });

  const rosterStats = {
    total: mockPlayers.length,
    active: mockPlayers.filter(p => p.status === 'active').length,
    injured: mockPlayers.filter(p => p.status === 'injured').length,
    avgGpa: (mockPlayers.reduce((acc, p) => acc + p.gpa, 0) / mockPlayers.length).toFixed(2)
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
          <Button variant="gold" onClick={() => showToast('Player creation coming soon!', 'info')}>+ Add Player</Button>
          <Button variant="primary" onClick={() => showToast('Sign in coming soon!', 'info')}>Sign In</Button>
        </div>
      </nav>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div>
            <h1 style={styles.headerTitle}>👥 Team Roster</h1>
            <p style={styles.headerSubtitle}>Riverside Wildcats • 2024 Season</p>
          </div>
          <div style={styles.headerActions}>
            <Button variant="ghost" onClick={() => showToast('Exporting roster...', 'success')}>📤 Export</Button>
            <Button variant="ghost" onClick={() => showToast('Print dialog coming soon!', 'info')}>🖨️ Print</Button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#667eea' }}>{rosterStats.total}</div>
            <div style={styles.statLabel}>Total Players</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#22c55e' }}>{rosterStats.active}</div>
            <div style={styles.statLabel}>Active</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#ef4444' }}>{rosterStats.injured}</div>
            <div style={styles.statLabel}>Injured</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: '#eab308' }}>{rosterStats.avgGpa}</div>
            <div style={styles.statLabel}>Avg GPA</div>
          </div>
        </div>

        {/* Filters */}
        <div style={styles.filters}>
          <div style={styles.filterTabs}>
            {positionGroups.map(group => (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                style={{
                  ...styles.filterTab,
                  ...(activeGroup === group.id ? styles.filterTabActive : {})
                }}
              >
                {group.name}
              </button>
            ))}
          </div>
          <div style={styles.searchBox}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--osys-gradient-primary)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'list' ? 'var(--osys-gradient-primary)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.rosterGrid}>
          {filteredPlayers.map(player => (
            <div key={player.id} style={styles.playerCard}>
              <div style={styles.playerHeader}>
                <div style={styles.playerNumber}>#{player.number}</div>
                <div style={styles.playerInfo}>
                  <div style={styles.playerName}>
                    {player.name}
                    {player.isCaptain && <span title="Team Captain">©️</span>}
                  </div>
                  <div style={styles.playerPosition}>
                    {player.position} • {player.year}
                  </div>
                  <div style={styles.playerBadges}>
                    <Badge 
                      variant={player.status === 'active' ? 'success' : player.status === 'injured' ? 'error' : 'warning'}
                    >
                      {player.status.charAt(0).toUpperCase() + player.status.slice(1)}
                    </Badge>
                    {player.isStarter && <Badge variant="primary">Starter</Badge>}
                  </div>
                </div>
              </div>
              <div style={styles.playerBody}>
                <div style={styles.playerStats}>
                  <div style={styles.playerStat}>
                    <div style={styles.playerStatValue}>{player.height}</div>
                    <div style={styles.playerStatLabel}>Height</div>
                  </div>
                  <div style={styles.playerStat}>
                    <div style={styles.playerStatValue}>{player.weight}</div>
                    <div style={styles.playerStatLabel}>Weight</div>
                  </div>
                  <div style={styles.playerStat}>
                    <div style={styles.playerStatValue}>{player.gpa}</div>
                    <div style={styles.playerStatLabel}>GPA</div>
                  </div>
                  <div style={styles.playerStat}>
                    <div style={styles.playerStatValue}>{player.stats.gamesPlayed}</div>
                    <div style={styles.playerStatLabel}>Games</div>
                  </div>
                </div>
                <div style={styles.playerFooter}>
                  <span style={styles.playerHometown}>📍 {player.hometown}</span>
                  <Button variant="ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }} onClick={() => showToast('Player profile coming soon!', 'info')}>
                    View Profile →
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <GlassCard>
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <h3 style={{ margin: '0 0 0.5rem' }}>No players found</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                Try adjusting your search or filters
              </p>
            </div>
          </GlassCard>
        )}
      </div>

      <DemoNavigation />
      {ToastComponent}
    </div>
  );
};

export default OSYSRoster;
