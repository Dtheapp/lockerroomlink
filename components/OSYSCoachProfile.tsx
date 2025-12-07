import React, { useState } from 'react';
import { AnimatedBackground, GlassCard, Button, Badge, ProgressBar } from './ui/OSYSComponents';
import { DemoNavigation } from './ui/DemoNavigation';

// Types
interface Achievement {
  id: string;
  title: string;
  year: string;
  icon: string;
}

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  year: string;
  status: 'starter' | 'active' | 'injured';
}

interface PlaybookItem {
  id: string;
  name: string;
  category: string;
  downloads: number;
  rating: number;
}

// Mock Data
const mockCoach = {
  name: "Coach Mike Thompson",
  title: "Head Football Coach",
  team: "Riverside Wildcats",
  teamEmoji: "🐾",
  sport: "Football",
  yearsCoaching: 15,
  record: "142-38",
  winPercentage: "78.9%",
  championships: 4,
  playoffsAppearances: 12,
  bio: "15+ years developing championship-caliber athletes and building winning programs. Focused on character development, academic excellence, and competitive success.",
  location: "Austin, TX",
  email: "coach.thompson@wildcats.edu",
  phone: "(555) 123-4567",
  philosophy: "Build champions on and off the field. Every practice is a chance to get better.",
  verified: true
};

const mockAchievements: Achievement[] = [
  { id: '1', title: "State Championship", year: "2023", icon: "🏆" },
  { id: '2', title: "Coach of the Year", year: "2022", icon: "⭐" },
  { id: '3', title: "Conference Champions", year: "2021", icon: "🥇" },
  { id: '4', title: "100 Career Wins", year: "2020", icon: "💯" },
  { id: '5', title: "Regional Champions", year: "2019", icon: "🏅" },
  { id: '6', title: "State Semifinals", year: "2018", icon: "🎯" },
];

const mockRoster: Player[] = [
  { id: '1', name: "Marcus Johnson", number: 7, position: "QB", year: "Senior", status: 'starter' },
  { id: '2', name: "Tyler Chen", number: 23, position: "RB", year: "Junior", status: 'starter' },
  { id: '3', name: "Darius Williams", number: 88, position: "WR", year: "Senior", status: 'starter' },
  { id: '4', name: "Jake Martinez", number: 55, position: "OL", year: "Senior", status: 'starter' },
  { id: '5', name: "Chris Thompson", number: 99, position: "DL", year: "Junior", status: 'starter' },
  { id: '6', name: "Aiden Smith", number: 15, position: "WR", year: "Sophomore", status: 'active' },
];

const mockPlaybooks: PlaybookItem[] = [
  { id: '1', name: "West Coast Offense Basics", category: "Offense", downloads: 1247, rating: 4.9 },
  { id: '2', name: "4-3 Defense Fundamentals", category: "Defense", downloads: 892, rating: 4.8 },
  { id: '3', name: "Red Zone Strategies", category: "Special Teams", downloads: 654, rating: 4.7 },
];

const mockStats = {
  currentSeason: {
    record: "8-2",
    pointsScored: 312,
    pointsAllowed: 148,
    rank: "#3 in Region"
  },
  playerDevelopment: {
    collegeCommits: 8,
    scholarships: "$1.2M+",
    allConference: 12,
    academicAward: 18
  }
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
  heroSection: {
    padding: '2rem 2rem 4rem',
    textAlign: 'center' as const,
    position: 'relative',
    zIndex: 1
  },
  profileCircle: {
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '4rem',
    margin: '0 auto 1.5rem',
    border: '4px solid rgba(255,255,255,0.2)',
    boxShadow: '0 20px 60px rgba(102,126,234,0.4)'
  },
  coachName: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 0.25rem',
    background: 'var(--osys-gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  coachTitle: {
    fontSize: '1.25rem',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem'
  },
  verifiedBadge: {
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    color: 'white',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem'
  },
  teamInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    color: 'rgba(255,255,255,0.6)'
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    marginBottom: '2rem'
  },
  statItem: {
    textAlign: 'center' as const
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 700,
    background: 'var(--osys-gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem'
  },
  heroActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap' as const
  },
  content: {
    padding: '0 2rem 4rem',
    maxWidth: '1400px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem'
  },
  fullWidth: {
    gridColumn: '1 / -1'
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  achievementGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem'
  },
  achievementCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '1rem',
    textAlign: 'center' as const,
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'all 0.3s'
  },
  achievementIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem'
  },
  achievementTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  achievementYear: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)'
  },
  rosterTable: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },
  rosterHeader: {
    textAlign: 'left' as const,
    padding: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.875rem',
    fontWeight: 500
  },
  rosterCell: {
    padding: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  playerNumber: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '8px',
    fontWeight: 700,
    fontSize: '0.875rem'
  },
  statusBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 500
  },
  playbookCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '1rem',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.75rem'
  },
  playbookIcon: {
    width: '48px',
    height: '48px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem'
  },
  playbookInfo: {
    flex: 1
  },
  playbookName: {
    fontWeight: 600,
    marginBottom: '0.25rem'
  },
  playbookMeta: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    display: 'flex',
    gap: '1rem'
  },
  bioSection: {
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '1rem'
  },
  philosophy: {
    background: 'linear-gradient(135deg, rgba(102,126,234,0.2) 0%, rgba(118,75,162,0.1) 100%)',
    borderLeft: '4px solid var(--osys-purple)',
    padding: '1rem 1.5rem',
    borderRadius: '0 12px 12px 0',
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '1.5rem'
  },
  contactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem'
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  contactIcon: {
    width: '40px',
    height: '40px',
    background: 'var(--osys-gradient-primary)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem'
  },
  contactText: {
    flex: 1
  },
  contactLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '0.125rem'
  },
  contactValue: {
    fontSize: '0.875rem',
    fontWeight: 500
  },
  seasonCard: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(16,185,129,0.1) 100%)',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(34,197,94,0.3)'
  },
  seasonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginTop: '1rem'
  },
  seasonStat: {
    textAlign: 'center' as const
  },
  seasonStatValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#22c55e'
  },
  seasonStatLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem'
  }
};

export const OSYSCoachProfile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'roster' | 'playbooks' | 'achievements'>('roster');

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'starter':
        return { background: 'rgba(34,197,94,0.2)', color: '#22c55e' };
      case 'active':
        return { background: 'rgba(59,130,246,0.2)', color: '#3b82f6' };
      case 'injured':
        return { background: 'rgba(239,68,68,0.2)', color: '#ef4444' };
      default:
        return { background: 'rgba(255,255,255,0.1)', color: 'white' };
    }
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
          <Button variant="ghost">🔔</Button>
          <Button variant="primary">Sign In</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={styles.heroSection}>
        <div style={styles.profileCircle}>👨‍🏫</div>
        <h1 style={styles.coachName}>{mockCoach.name}</h1>
        <div style={styles.coachTitle}>
          {mockCoach.title}
          {mockCoach.verified && (
            <span style={styles.verifiedBadge}>✓ Verified</span>
          )}
        </div>
        <div style={styles.teamInfo}>
          <span>{mockCoach.teamEmoji}</span>
          <span>{mockCoach.team}</span>
          <span>•</span>
          <span>{mockCoach.sport}</span>
          <span>•</span>
          <span>📍 {mockCoach.location}</span>
        </div>
        
        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{mockCoach.yearsCoaching}</div>
            <div style={styles.statLabel}>Years Coaching</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{mockCoach.record}</div>
            <div style={styles.statLabel}>Career Record</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{mockCoach.winPercentage}</div>
            <div style={styles.statLabel}>Win %</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{mockCoach.championships}</div>
            <div style={styles.statLabel}>Championships</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statValue}>{mockCoach.playoffsAppearances}</div>
            <div style={styles.statLabel}>Playoff Runs</div>
          </div>
        </div>

        <div style={styles.heroActions}>
          <Button variant="gold">💬 Message Coach</Button>
          <Button variant="primary">👥 Follow Team</Button>
          <Button variant="ghost">🔗 Share Profile</Button>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <div style={styles.grid}>
          {/* Current Season */}
          <div style={styles.fullWidth}>
            <div style={styles.seasonCard}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
                🏈 2024 Season
              </h3>
              <div style={styles.seasonGrid}>
                <div style={styles.seasonStat}>
                  <div style={styles.seasonStatValue}>{mockStats.currentSeason.record}</div>
                  <div style={styles.seasonStatLabel}>Record</div>
                </div>
                <div style={styles.seasonStat}>
                  <div style={styles.seasonStatValue}>{mockStats.currentSeason.pointsScored}</div>
                  <div style={styles.seasonStatLabel}>Points Scored</div>
                </div>
                <div style={styles.seasonStat}>
                  <div style={styles.seasonStatValue}>{mockStats.currentSeason.pointsAllowed}</div>
                  <div style={styles.seasonStatLabel}>Points Allowed</div>
                </div>
                <div style={styles.seasonStat}>
                  <div style={styles.seasonStatValue}>{mockStats.currentSeason.rank}</div>
                  <div style={styles.seasonStatLabel}>Ranking</div>
                </div>
              </div>
            </div>
          </div>

          {/* About & Contact */}
          <GlassCard>
            <h3 style={styles.sectionTitle}>👨‍🏫 About Coach Thompson</h3>
            <div style={styles.philosophy}>
              "{mockCoach.philosophy}"
            </div>
            <p style={styles.bioSection}>{mockCoach.bio}</p>
            
            <div style={styles.contactGrid}>
              <div style={styles.contactItem}>
                <div style={styles.contactIcon}>📧</div>
                <div style={styles.contactText}>
                  <div style={styles.contactLabel}>Email</div>
                  <div style={styles.contactValue}>{mockCoach.email}</div>
                </div>
              </div>
              <div style={styles.contactItem}>
                <div style={styles.contactIcon}>📱</div>
                <div style={styles.contactText}>
                  <div style={styles.contactLabel}>Phone</div>
                  <div style={styles.contactValue}>{mockCoach.phone}</div>
                </div>
              </div>
              <div style={styles.contactItem}>
                <div style={styles.contactIcon}>📍</div>
                <div style={styles.contactText}>
                  <div style={styles.contactLabel}>Location</div>
                  <div style={styles.contactValue}>{mockCoach.location}</div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Player Development */}
          <GlassCard>
            <h3 style={styles.sectionTitle}>🌟 Player Development</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(102,126,234,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#667eea' }}>
                  {mockStats.playerDevelopment.collegeCommits}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>College Commits</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(234,179,8,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#eab308' }}>
                  {mockStats.playerDevelopment.scholarships}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>In Scholarships</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(34,197,94,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>
                  {mockStats.playerDevelopment.allConference}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>All-Conference</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(139,92,246,0.1)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#8b5cf6' }}>
                  {mockStats.playerDevelopment.academicAward}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>Academic Awards</div>
              </div>
            </div>
          </GlassCard>

          {/* Achievements */}
          <div style={styles.fullWidth}>
            <GlassCard>
              <h3 style={styles.sectionTitle}>🏆 Career Achievements</h3>
              <div style={styles.achievementGrid}>
                {mockAchievements.map(achievement => (
                  <div key={achievement.id} style={styles.achievementCard}>
                    <div style={styles.achievementIcon}>{achievement.icon}</div>
                    <div style={styles.achievementTitle}>{achievement.title}</div>
                    <div style={styles.achievementYear}>{achievement.year}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Roster Preview */}
          <GlassCard>
            <h3 style={styles.sectionTitle}>👥 Current Roster</h3>
            <table style={styles.rosterTable}>
              <thead>
                <tr>
                  <th style={styles.rosterHeader}>#</th>
                  <th style={styles.rosterHeader}>Player</th>
                  <th style={styles.rosterHeader}>Pos</th>
                  <th style={styles.rosterHeader}>Year</th>
                  <th style={styles.rosterHeader}>Status</th>
                </tr>
              </thead>
              <tbody>
                {mockRoster.map(player => (
                  <tr key={player.id}>
                    <td style={styles.rosterCell}>
                      <span style={styles.playerNumber}>{player.number}</span>
                    </td>
                    <td style={styles.rosterCell}>
                      <span style={{ fontWeight: 500 }}>{player.name}</span>
                    </td>
                    <td style={styles.rosterCell}>{player.position}</td>
                    <td style={styles.rosterCell}>{player.year}</td>
                    <td style={styles.rosterCell}>
                      <span style={{ ...styles.statusBadge, ...getStatusStyle(player.status) }}>
                        {player.status.charAt(0).toUpperCase() + player.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <Button variant="ghost">View Full Roster →</Button>
            </div>
          </GlassCard>

          {/* Playbooks */}
          <GlassCard>
            <h3 style={styles.sectionTitle}>📋 Shared Playbooks</h3>
            {mockPlaybooks.map(playbook => (
              <div key={playbook.id} style={styles.playbookCard}>
                <div style={styles.playbookIcon}>📘</div>
                <div style={styles.playbookInfo}>
                  <div style={styles.playbookName}>{playbook.name}</div>
                  <div style={styles.playbookMeta}>
                    <span>{playbook.category}</span>
                    <span>📥 {playbook.downloads}</span>
                    <span>⭐ {playbook.rating}</span>
                  </div>
                </div>
                <Button variant="primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                  View
                </Button>
              </div>
            ))}
            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              <Button variant="ghost">Browse All Playbooks →</Button>
            </div>
          </GlassCard>
        </div>
      </div>

      <DemoNavigation />
    </div>
  );
};

export default OSYSCoachProfile;
