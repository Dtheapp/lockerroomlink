import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge, ProgressBar } from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';

// Types
interface Play {
  id: string;
  name: string;
  category: 'offense' | 'defense' | 'special';
  formation: string;
  diagram: string;
  description: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  successRate?: number;
  usageCount: number;
  isFavorite?: boolean;
}

interface PlayCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

// Mock Data
const mockPlays: Play[] = [
  {
    id: '1',
    name: 'Power Sweep Right',
    category: 'offense',
    formation: 'I-Formation',
    diagram: '🏈',
    description: 'Strong-side power run with pulling guard and lead block. Best used against man coverage.',
    tags: ['run', 'power', 'short-yardage'],
    difficulty: 'intermediate',
    successRate: 72,
    usageCount: 45,
    isFavorite: true
  },
  {
    id: '2',
    name: 'PA Boot Left',
    category: 'offense',
    formation: 'Pro Set',
    diagram: '🎯',
    description: 'Play-action bootleg with crossing routes. QB rolls left with two receivers in the pattern.',
    tags: ['pass', 'play-action', 'red-zone'],
    difficulty: 'advanced',
    successRate: 68,
    usageCount: 32
  },
  {
    id: '3',
    name: 'Cover 3 Sky',
    category: 'defense',
    formation: '4-3',
    diagram: '🛡️',
    description: 'Three-deep zone with strong safety rotated down. Excellent against run-heavy teams.',
    tags: ['zone', 'coverage', 'base'],
    difficulty: 'beginner',
    successRate: 65,
    usageCount: 89
  },
  {
    id: '4',
    name: 'Fire Zone Blitz',
    category: 'defense',
    formation: '3-4',
    diagram: '🔥',
    description: 'Five-man pressure with zone coverage behind. Linebacker and safety blitz from weak side.',
    tags: ['blitz', 'pressure', 'third-down'],
    difficulty: 'advanced',
    successRate: 58,
    usageCount: 28,
    isFavorite: true
  },
  {
    id: '5',
    name: 'Onside Kick',
    category: 'special',
    formation: 'Kick Formation',
    diagram: '⚡',
    description: 'Surprise onside kick to right side. Best when opponent not expecting.',
    tags: ['special-teams', 'trick', 'late-game'],
    difficulty: 'intermediate',
    successRate: 35,
    usageCount: 8
  },
  {
    id: '6',
    name: 'Mesh Concept',
    category: 'offense',
    formation: 'Spread',
    diagram: '🎯',
    description: 'Two receivers cross underneath creating natural picks. High-percentage throw.',
    tags: ['pass', 'short', 'quick-game'],
    difficulty: 'beginner',
    successRate: 78,
    usageCount: 67
  },
  {
    id: '7',
    name: 'Tampa 2',
    category: 'defense',
    formation: '4-3',
    diagram: '🛡️',
    description: 'Two-deep safety look with MLB dropping deep middle. Strong against deep passes.',
    tags: ['zone', 'coverage', 'prevent'],
    difficulty: 'intermediate',
    successRate: 62,
    usageCount: 54
  },
  {
    id: '8',
    name: 'Fake Punt Pass',
    category: 'special',
    formation: 'Punt',
    diagram: '🎭',
    description: 'Punter throws to personal protector releasing into flat. 4th down conversion play.',
    tags: ['special-teams', 'trick', 'fourth-down'],
    difficulty: 'advanced',
    successRate: 42,
    usageCount: 5
  }
];

const categories: PlayCategory[] = [
  { id: 'all', name: 'All Plays', icon: '📋', count: mockPlays.length },
  { id: 'offense', name: 'Offense', icon: '🏈', count: mockPlays.filter(p => p.category === 'offense').length },
  { id: 'defense', name: 'Defense', icon: '🛡️', count: mockPlays.filter(p => p.category === 'defense').length },
  { id: 'special', name: 'Special Teams', icon: '⚡', count: mockPlays.filter(p => p.category === 'special').length },
  { id: 'favorites', name: 'Favorites', icon: '⭐', count: mockPlays.filter(p => p.isFavorite).length }
];

const formationOptions = ['All Formations', 'I-Formation', 'Pro Set', 'Spread', '4-3', '3-4', 'Nickel', 'Dime'];

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
  layout: {
    display: 'flex',
    gap: '2rem',
    padding: '1rem 2rem 2rem',
    maxWidth: '1800px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1
  },
  sidebar: {
    width: '280px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem'
  },
  main: {
    flex: 1,
    minWidth: 0
  },
  categoryList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  categoryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'rgba(255,255,255,0.05)'
  },
  categoryItemActive: {
    background: 'var(--osys-gradient-primary)'
  },
  categoryIcon: {
    fontSize: '1.25rem'
  },
  categoryName: {
    flex: 1,
    fontWeight: 500
  },
  categoryCount: {
    fontSize: '0.875rem',
    opacity: 0.7,
    background: 'rgba(255,255,255,0.1)',
    padding: '0.25rem 0.5rem',
    borderRadius: '8px'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '0.9375rem',
    outline: 'none'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem'
  },
  headerTitle: {
    fontSize: '1.75rem',
    fontWeight: 700,
    background: 'var(--osys-gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem'
  },
  select: {
    padding: '0.625rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    fontSize: '0.875rem',
    outline: 'none',
    cursor: 'pointer'
  },
  playsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '1rem'
  },
  playCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  playDiagram: {
    height: '140px',
    background: 'linear-gradient(135deg, rgba(102,126,234,0.3) 0%, rgba(118,75,162,0.2) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const
  },
  playDiagramIcon: {
    fontSize: '3rem',
    opacity: 0.7
  },
  playFavorite: {
    position: 'absolute' as const,
    top: '0.75rem',
    right: '0.75rem',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  playDifficulty: {
    position: 'absolute' as const,
    top: '0.75rem',
    left: '0.75rem',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 500
  },
  playContent: {
    padding: '1.25rem'
  },
  playHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem'
  },
  playName: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  playFormation: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)'
  },
  playStats: {
    textAlign: 'right' as const
  },
  playStatValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#22c55e'
  },
  playStatLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)'
  },
  playDescription: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
    marginBottom: '1rem'
  },
  playTags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    marginBottom: '1rem'
  },
  playTag: {
    padding: '0.25rem 0.625rem',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.1)',
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.7)'
  },
  playFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  playUsage: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.5)'
  },
  quickStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem'
  },
  quickStatCard: {
    padding: '1rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    textAlign: 'center' as const
  },
  quickStatValue: {
    fontSize: '1.5rem',
    fontWeight: 700
  },
  quickStatLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '0.25rem'
  },
  recentActivity: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem'
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    fontSize: '0.875rem'
  }
};

const getDifficultyStyle = (difficulty: string) => {
  switch (difficulty) {
    case 'beginner':
      return { background: 'rgba(34,197,94,0.3)', color: '#22c55e' };
    case 'intermediate':
      return { background: 'rgba(234,179,8,0.3)', color: '#eab308' };
    case 'advanced':
      return { background: 'rgba(239,68,68,0.3)', color: '#ef4444' };
    default:
      return { background: 'rgba(255,255,255,0.2)', color: 'white' };
  }
};

export const OSYSPlaybook: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormation, setSelectedFormation] = useState('All Formations');

  const filteredPlays = mockPlays.filter(play => {
    if (activeCategory === 'favorites' && !play.isFavorite) return false;
    if (activeCategory !== 'all' && activeCategory !== 'favorites' && play.category !== activeCategory) return false;
    if (selectedFormation !== 'All Formations' && play.formation !== selectedFormation) return false;
    if (searchQuery && !play.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !play.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  const totalPlays = mockPlays.length;
  const avgSuccessRate = Math.round(mockPlays.reduce((acc, p) => acc + (p.successRate || 0), 0) / mockPlays.length);
  const totalUsage = mockPlays.reduce((acc, p) => acc + p.usageCount, 0);

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
          <Button variant="gold">+ New Play</Button>
          <Button variant="primary">Sign In</Button>
        </div>
      </nav>

      <div style={styles.layout}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          {/* Search */}
          <div style={styles.searchBox}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search plays..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          {/* Categories */}
          <GlassCard>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>📁 Categories</h3>
            <div style={styles.categoryList}>
              {categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    ...styles.categoryItem,
                    ...(activeCategory === cat.id ? styles.categoryItemActive : {})
                  }}
                >
                  <span style={styles.categoryIcon}>{cat.icon}</span>
                  <span style={styles.categoryName}>{cat.name}</span>
                  <span style={styles.categoryCount}>{cat.count}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Quick Stats */}
          <GlassCard>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>📊 Playbook Stats</h3>
            <div style={styles.quickStats}>
              <div style={styles.quickStatCard}>
                <div style={{ ...styles.quickStatValue, color: '#667eea' }}>{totalPlays}</div>
                <div style={styles.quickStatLabel}>Total Plays</div>
              </div>
              <div style={styles.quickStatCard}>
                <div style={{ ...styles.quickStatValue, color: '#22c55e' }}>{avgSuccessRate}%</div>
                <div style={styles.quickStatLabel}>Avg Success</div>
              </div>
              <div style={styles.quickStatCard}>
                <div style={{ ...styles.quickStatValue, color: '#eab308' }}>{totalUsage}</div>
                <div style={styles.quickStatLabel}>Times Used</div>
              </div>
              <div style={styles.quickStatCard}>
                <div style={{ ...styles.quickStatValue, color: '#8b5cf6' }}>
                  {mockPlays.filter(p => p.isFavorite).length}
                </div>
                <div style={styles.quickStatLabel}>Favorites</div>
              </div>
            </div>
          </GlassCard>

          {/* Recent Activity */}
          <GlassCard>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>🕐 Recent</h3>
            <div style={styles.recentActivity}>
              <div style={styles.activityItem}>
                <span>📝</span>
                <span>Edited "Power Sweep"</span>
              </div>
              <div style={styles.activityItem}>
                <span>➕</span>
                <span>Added "Mesh Concept"</span>
              </div>
              <div style={styles.activityItem}>
                <span>⭐</span>
                <span>Favorited "Fire Zone"</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Main Content */}
        <div style={styles.main}>
          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.headerTitle}>📋 Team Playbook</h1>
            <div style={styles.headerActions}>
              <select 
                value={selectedFormation}
                onChange={(e) => setSelectedFormation(e.target.value)}
                style={styles.select}
              >
                {formationOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <Button variant="ghost">🔄 Refresh</Button>
              <Button variant="primary">📤 Export</Button>
            </div>
          </div>

          {/* Plays Grid */}
          <div style={styles.playsGrid}>
            {filteredPlays.map(play => (
              <div key={play.id} style={styles.playCard}>
                <div style={styles.playDiagram}>
                  <div style={styles.playDiagramIcon}>{play.diagram}</div>
                  <div 
                    style={{ ...styles.playDifficulty, ...getDifficultyStyle(play.difficulty) }}
                  >
                    {play.difficulty.charAt(0).toUpperCase() + play.difficulty.slice(1)}
                  </div>
                  <div style={styles.playFavorite}>
                    {play.isFavorite ? '⭐' : '☆'}
                  </div>
                </div>
                <div style={styles.playContent}>
                  <div style={styles.playHeader}>
                    <div>
                      <div style={styles.playName}>{play.name}</div>
                      <div style={styles.playFormation}>{play.formation}</div>
                    </div>
                    {play.successRate && (
                      <div style={styles.playStats}>
                        <div style={styles.playStatValue}>{play.successRate}%</div>
                        <div style={styles.playStatLabel}>Success Rate</div>
                      </div>
                    )}
                  </div>
                  <p style={styles.playDescription}>{play.description}</p>
                  <div style={styles.playTags}>
                    {play.tags.map(tag => (
                      <span key={tag} style={styles.playTag}>{tag}</span>
                    ))}
                  </div>
                  <div style={styles.playFooter}>
                    <span style={styles.playUsage}>Used {play.usageCount} times</span>
                    <Button variant="primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredPlays.length === 0 && (
            <GlassCard>
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ margin: '0 0 0.5rem' }}>No plays found</h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                  Try adjusting your filters or search query
                </p>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <DemoNavigation />
    </div>
  );
};

export default OSYSPlaybook;
